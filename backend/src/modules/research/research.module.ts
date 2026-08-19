import { Router } from "express";
import { z } from "zod";
import { pool, transaction } from "../../db/pool.js";
import { ConflictError, NotFoundError, ValidationError } from "../../common/errors.js";
import { created, noContent, ok } from "../../common/api.js";
import { handler, idParam, parseBody, queryString } from "../../common/http.js";
import { isValidSlug, slugify, uniqueSlug } from "../../common/slug.js";
import { mediaByIds, requireMedia } from "../media/media.service.js";
import { resolveTaxonomy } from "../technology/technology.service.js";

/**
 * Research entries (D-014). Deliberately simpler than Blog: an entry points OUT to a paper via
 * `externalUrl` or an uploaded PDF, so there is no rich-text body, no sanitizer and no detail
 * route — the list item is the whole thing.
 */
const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

const schema = z.object({
  title: z.string().trim().min(1, "must not be blank").max(250),
  slug: z.string().max(270).nullish(),
  // Named abstractText, not abstract: `abstract` is a reserved word in Java, and the two
  // implementations must expose one identical contract.
  abstractText: z.string().trim().min(1, "must not be blank").max(600),
  publicationVenue: z.string().max(250).nullish(),
  publicationDate: z.string().nullish(),
  externalUrl: z.string().max(500).nullish(),
  pdfMediaId: z.number().nullish(),
  tags: z.array(z.string()).nullish(),
  status: z.enum(STATUSES).nullish(),
  displayOrder: z.number().int().nullish(),
  aiVisible: z.boolean().nullish(),
});

export const researchPublicRouter = Router();
export const researchAdminRouter = Router();

researchPublicRouter.get(
  "/research",
  handler(async (req, res) => {
    const tag = queryString(req, "tag") ?? null;
    const { rows } = await pool.query(
      `SELECT r.* FROM research r
       WHERE r.deleted_at IS NULL AND r.status = 'PUBLISHED'
         AND ($1::text IS NULL OR EXISTS (
               SELECT 1 FROM research_tag rt JOIN tag t ON t.id = rt.tag_id
               WHERE rt.research_id = r.id AND t.slug = $1))
       ORDER BY r.publication_date DESC NULLS LAST, r.display_order ASC, r.id DESC`,
      [tag],
    );
    return ok(res, await toResponses(rows));
  }),
);

researchAdminRouter.get(
  "/admin/research",
  handler(async (req, res) => {
    const status = queryString(req, "status");
    const { rows } = await pool.query(
      `SELECT * FROM research WHERE deleted_at IS NULL ${status ? "AND status = $1" : ""}
       ORDER BY publication_date DESC NULLS LAST, display_order ASC, id DESC`,
      status ? [status] : [],
    );
    return ok(res, await toResponses(rows));
  }),
);

researchAdminRouter.get(
  "/admin/research/:id",
  handler(async (req, res) => ok(res, (await toResponses([await require(idParam(req))]))[0])),
);

researchAdminRouter.post(
  "/admin/research",
  handler(async (req, res) => {
    const id = await write(null, parseBody(schema, req.body));
    return created(res, (await toResponses([await require(id)]))[0], "Research created");
  }),
);

researchAdminRouter.put(
  "/admin/research/:id",
  handler(async (req, res) => {
    const id = idParam(req);
    await require(id);
    await write(id, parseBody(schema, req.body));
    return ok(res, (await toResponses([await require(id)]))[0], "Research updated");
  }),
);

researchAdminRouter.delete(
  "/admin/research/:id",
  handler(async (req, res) => {
    const { rowCount } = await pool.query(
      "UPDATE research SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL",
      [idParam(req)],
    );
    if (!rowCount) throw new NotFoundError(`Research ${req.params.id} not found`);
    return noContent(res);
  }),
);

type Body = z.infer<typeof schema>;

async function write(id: number | null, body: Body): Promise<number> {
  // An entry that links nowhere is not a research entry; one of the two routes out is required.
  if (!body.externalUrl?.trim() && !body.pdfMediaId) {
    throw new ValidationError("Provide an external URL, an uploaded PDF, or both");
  }
  const slug = await resolveSlug(body.slug ?? null, body.title, id);
  const pdfId = await requireMedia(body.pdfMediaId ?? null, "pdfMediaId");

  return transaction(async (client) => {
    const values = [
      body.title.trim(),
      slug,
      body.abstractText.trim(),
      body.publicationVenue?.trim() || null,
      body.publicationDate || null,
      body.externalUrl?.trim() || null,
      pdfId,
      body.status ?? "DRAFT",
      body.displayOrder ?? 0,
      body.aiVisible === true,
    ];

    let researchId: number;
    try {
      if (id) {
        await client.query(
          `UPDATE research SET title=$1, slug=$2, abstract=$3, publication_venue=$4,
                  publication_date=$5, external_url=$6, pdf_media_id=$7, status=$8,
                  display_order=$9, ai_visible=$10, updated_at=now()
           WHERE id=$11`,
          [...values, id],
        );
        researchId = id;
      } else {
        const inserted = await client.query<{ id: number }>(
          `INSERT INTO research (title, slug, abstract, publication_venue, publication_date,
                                 external_url, pdf_media_id, status, display_order, ai_visible)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
          values,
        );
        researchId = inserted.rows[0]!.id;
      }
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        throw new ConflictError(`A research entry with slug '${slug}' already exists`);
      }
      throw error;
    }

    await client.query("DELETE FROM research_tag WHERE research_id = $1", [researchId]);
    const seen = new Set<string>();
    for (const raw of body.tags ?? []) {
      if (!raw?.trim()) continue;
      const name = raw.trim().replace(/\s+/g, " ");
      if (seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      // Shares Blog's `tag` table, so a tag used on both sides is one row.
      const tagId = await resolveTaxonomy(name, "tag", client);
      if (tagId) {
        await client.query("INSERT INTO research_tag (research_id, tag_id) VALUES ($1, $2)", [researchId, tagId]);
      }
    }
    return researchId;
  });
}

async function resolveSlug(requested: string | null, title: string, id: number | null): Promise<string> {
  const taken = async (candidate: string) => {
    const { rowCount } = id
      ? await pool.query("SELECT 1 FROM research WHERE slug = $1 AND id <> $2 AND deleted_at IS NULL", [candidate, id])
      : await pool.query("SELECT 1 FROM research WHERE slug = $1 AND deleted_at IS NULL", [candidate]);
    return Boolean(rowCount);
  };
  if (requested?.trim()) {
    const slug = requested.trim();
    if (!isValidSlug(slug)) {
      throw new ValidationError("Slug must be lowercase alphanumeric words separated by single hyphens");
    }
    if (await taken(slug)) throw new ConflictError(`A research entry with slug '${slug}' already exists`);
    return slug;
  }
  const base = slugify(title);
  if (!base) throw new ValidationError("Could not derive a slug from the title; supply one explicitly");
  return uniqueSlug(base, taken);
}

async function require(id: number): Promise<Record<string, any>> {
  const { rows } = await pool.query("SELECT * FROM research WHERE id = $1 AND deleted_at IS NULL", [id]);
  if (!rows.length) throw new NotFoundError(`Research ${id} not found`);
  return rows[0]!;
}

async function toResponses(rows: Record<string, any>[]) {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const { rows: joined } = await pool.query<{ research_id: number; name: string }>(
    `SELECT rt.research_id, t.name FROM research_tag rt JOIN tag t ON t.id = rt.tag_id
     WHERE rt.research_id = ANY($1::bigint[])`,
    [ids],
  );
  const byResearch = new Map<number, string[]>();
  for (const row of joined) {
    byResearch.set(row.research_id, [...(byResearch.get(row.research_id) ?? []), row.name]);
  }
  const media = await mediaByIds(rows.map((row) => row.pdf_media_id).filter(Boolean));

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    abstractText: row.abstract,
    publicationVenue: row.publication_venue,
    publicationDate: row.publication_date,
    externalUrl: row.external_url,
    pdf: row.pdf_media_id ? media.get(row.pdf_media_id) ?? null : null,
    tags: (byResearch.get(row.id) ?? []).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())),
    status: row.status,
    displayOrder: row.display_order,
    aiVisible: row.ai_visible,
    createdAt: row.created_at?.toISOString() ?? null,
    updatedAt: row.updated_at?.toISOString() ?? null,
  }));
}
