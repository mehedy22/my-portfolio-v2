import { Router } from "express";
import { z } from "zod";
import { pool, transaction } from "../../db/pool.js";
import { ConflictError, NotFoundError, ValidationError } from "../../common/errors.js";
import { created, noContent, ok, page, pageParams } from "../../common/api.js";
import { handler, parseBody, queryString, idParam } from "../../common/http.js";
import { isValidSlug, slugify, uniqueSlug } from "../../common/slug.js";
import { mediaByIds, requireMedia } from "../media/media.service.js";
import { resolveTechnologies } from "../technology/technology.service.js";

const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
const PROJECT_TYPES = ["PERSONAL", "PROFESSIONAL", "OPEN_SOURCE", "CLIENT"] as const;
const SORTABLE: Record<string, string> = {
  displayOrder: "display_order",
  createdAt: "created_at",
  updatedAt: "updated_at",
  title: "title",
};

const challengeSchema = z.object({
  title: z.string().trim().min(1, "must not be blank").max(200),
  challenge: z.string().min(1, "must not be blank"),
  solution: z.string().min(1, "must not be blank"),
});

const schema = z.object({
  title: z.string().trim().min(1, "must not be blank").max(200),
  slug: z.string().max(220).nullish(),
  shortDescription: z.string().trim().min(1, "must not be blank").max(500),
  detailedDescription: z.string().nullish(),
  thumbnailMediaId: z.number().nullish(),
  githubUrl: z.string().max(500).nullish(),
  liveUrl: z.string().max(500).nullish(),
  projectType: z.enum(PROJECT_TYPES).nullish(),
  startDate: z.string().nullish(),
  endDate: z.string().nullish(),
  featured: z.boolean().nullish(),
  displayOrder: z.number().int().nullish(),
  features: z.string().nullish(),
  aiVisible: z.boolean().nullish(),
  technologies: z.array(z.string()).nullish(),
  challenges: z.array(challengeSchema).nullish(),
  galleryMediaIds: z.array(z.number()).nullish(),
});

const statusSchema = z.object({ status: z.enum(STATUSES) });

export const projectPublicRouter = Router();
export const projectAdminRouter = Router();

// --------------------------------------------------------------- public

projectPublicRouter.get(
  "/projects",
  handler(async (req, res) => {
    const search = queryString(req, "search");
    const { rows } = search
      ? await pool.query(
          `SELECT DISTINCT p.* FROM project p
             LEFT JOIN project_technology pt ON pt.project_id = p.id
             LEFT JOIN technology t ON t.id = pt.technology_id
           WHERE p.deleted_at IS NULL AND p.status = 'PUBLISHED'
             AND (lower(p.title) LIKE lower('%' || $1 || '%')
                  OR lower(p.short_description) LIKE lower('%' || $1 || '%')
                  OR lower(t.name) LIKE lower('%' || $1 || '%'))
           ORDER BY p.display_order ASC, p.id ASC`,
          [search],
        )
      : await pool.query(
          `SELECT * FROM project WHERE deleted_at IS NULL AND status = 'PUBLISHED'
           ORDER BY display_order ASC, id ASC`,
        );
    return ok(res, await toSummaries(rows));
  }),
);

projectPublicRouter.get(
  "/projects/:slug",
  handler(async (req, res) => {
    const { rows } = await pool.query(
      "SELECT * FROM project WHERE slug = $1 AND status = 'PUBLISHED' AND deleted_at IS NULL",
      [req.params.slug],
    );
    // Deliberately the same 404 a nonexistent slug gets: a draft's existence must not be
    // confirmable from the public API.
    if (!rows.length) throw new NotFoundError(`Project '${req.params.slug}' not found`);
    return ok(res, await toDetail(rows[0]!));
  }),
);

// ---------------------------------------------------------------- admin

projectAdminRouter.get(
  "/admin/projects",
  handler(async (req, res) => {
    const { page: pageNumber, size, offset } = pageParams(req.query, 20, 100);
    const status = queryString(req, "status");
    const sort = queryString(req, "sort");

    let orderBy = "display_order ASC, id DESC";
    if (sort) {
      const [field, direction] = sort.split(",");
      const column = SORTABLE[field?.trim() ?? ""];
      // Whitelisted: a client-supplied property would otherwise reach the query planner.
      if (!column) {
        throw new ValidationError(
          `Cannot sort by '${field?.trim()}'. Allowed: ${Object.keys(SORTABLE).sort().join(", ")}`,
        );
      }
      orderBy = `${column} ${direction?.trim().toLowerCase() === "desc" ? "DESC" : "ASC"}, id DESC`;
    }

    const where = status ? "WHERE deleted_at IS NULL AND status = $1" : "WHERE deleted_at IS NULL";
    const params = status ? [status] : [];
    const { rows } = await pool.query(
      `SELECT * FROM project ${where} ORDER BY ${orderBy} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, size, offset],
    );
    const { rows: counted } = await pool.query<{ count: string }>(
      `SELECT count(*) FROM project ${where}`,
      params,
    );
    return ok(res, page(await toSummaries(rows), pageNumber, size, Number(counted[0]!.count)));
  }),
);

projectAdminRouter.get(
  "/admin/projects/:id",
  handler(async (req, res) => ok(res, await toDetail(await require(idParam(req))))),
);

projectAdminRouter.post(
  "/admin/projects",
  handler(async (req, res) => {
    const body = parseBody(schema, req.body);
    const id = await write(null, body);
    return created(res, await toDetail(await require(id)), "Project created");
  }),
);

projectAdminRouter.put(
  "/admin/projects/:id",
  handler(async (req, res) => {
    const id = idParam(req);
    await require(id);
    const body = parseBody(schema, req.body);
    await write(id, body);
    return ok(res, await toDetail(await require(id)), "Project updated");
  }),
);

/** Status moves only here, so a routine content edit can never publish a draft by accident. */
projectAdminRouter.patch(
  "/admin/projects/:id/status",
  handler(async (req, res) => {
    const id = idParam(req);
    const { status } = parseBody(statusSchema, req.body);
    const { rowCount } = await pool.query(
      "UPDATE project SET status = $1, updated_at = now() WHERE id = $2 AND deleted_at IS NULL",
      [status, id],
    );
    if (!rowCount) throw new NotFoundError(`Project ${id} not found`);
    return ok(res, await toDetail(await require(id)), "Status updated");
  }),
);

projectAdminRouter.delete(
  "/admin/projects/:id",
  handler(async (req, res) => {
    const { rowCount } = await pool.query(
      "UPDATE project SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL",
      [idParam(req)],
    );
    if (!rowCount) throw new NotFoundError(`Project ${idParam(req)} not found`);
    return noContent(res);
  }),
);

// -------------------------------------------------------------- helpers

type Body = z.infer<typeof schema>;

/**
 * Whole-aggregate write: challenges, gallery and technologies are replaced, because they are part
 * of the project rather than resources with their own lifecycle.
 */
async function write(id: number | null, body: Body): Promise<number> {
  if (body.startDate && body.endDate && body.endDate < body.startDate) {
    throw new ValidationError("End date must not be before the start date");
  }

  const slug = await resolveSlug(body.slug ?? null, body.title, id);
  const thumbnailId = await requireMedia(body.thumbnailMediaId ?? null, "thumbnailMediaId");

  // Ids validated up front so a typo fails the whole write rather than silently dropping an image.
  const galleryIds = [...new Set((body.galleryMediaIds ?? []).filter((value) => Number.isFinite(value)))];
  if (galleryIds.length) {
    const found = await mediaByIds(galleryIds);
    const missing = galleryIds.filter((mediaId) => !found.has(mediaId));
    if (missing.length) throw new ValidationError(`Gallery media do not exist: [${missing.join(", ")}]`);
  }

  const technologyIds = await resolveTechnologies(body.technologies ?? undefined);

  return transaction(async (client) => {
    const values = [
      body.title.trim(),
      slug,
      body.shortDescription.trim(),
      body.detailedDescription ?? null,
      thumbnailId,
      body.githubUrl ?? null,
      body.liveUrl ?? null,
      body.projectType ?? null,
      body.startDate ?? null,
      body.endDate ?? null,
      body.featured === true,
      body.displayOrder ?? 0,
      body.features ?? null,
      body.aiVisible === true,
    ];

    let projectId: number;
    try {
      if (id) {
        await client.query(
          `UPDATE project SET title=$1, slug=$2, short_description=$3, detailed_description=$4,
                  thumbnail_media_id=$5, github_url=$6, live_url=$7, project_type=$8,
                  start_date=$9, end_date=$10, featured=$11, display_order=$12, features=$13,
                  ai_visible=$14, updated_at=now()
           WHERE id=$15`,
          [...values, id],
        );
        projectId = id;
      } else {
        const inserted = await client.query<{ id: number }>(
          `INSERT INTO project (title, slug, short_description, detailed_description,
                                thumbnail_media_id, github_url, live_url, project_type,
                                start_date, end_date, featured, display_order, features, ai_visible)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
          values,
        );
        projectId = inserted.rows[0]!.id;
      }
    } catch (error) {
      // The partial unique index is the guarantee; this turns a race into the documented 409.
      if ((error as { code?: string }).code === "23505") {
        throw new ConflictError(`A project with slug '${slug}' already exists`);
      }
      throw error;
    }

    await client.query("DELETE FROM project_challenge WHERE project_id = $1", [projectId]);
    const challenges = body.challenges ?? [];
    for (const [index, block] of challenges.entries()) {
      await client.query(
        `INSERT INTO project_challenge (project_id, title, challenge, solution, display_order)
         VALUES ($1, $2, $3, $4, $5)`,
        [projectId, block.title.trim(), block.challenge, block.solution, index],
      );
    }

    await client.query("DELETE FROM project_gallery WHERE project_id = $1", [projectId]);
    for (const [index, mediaId] of galleryIds.entries()) {
      await client.query(
        "INSERT INTO project_gallery (project_id, media_id, display_order) VALUES ($1, $2, $3)",
        [projectId, mediaId, index],
      );
    }

    await client.query("DELETE FROM project_technology WHERE project_id = $1", [projectId]);
    for (const technologyId of technologyIds) {
      await client.query(
        "INSERT INTO project_technology (project_id, technology_id) VALUES ($1, $2)",
        [projectId, technologyId],
      );
    }

    return projectId;
  });
}

/**
 * An explicitly supplied slug must be canonical and free — colliding is a 409, because the admin
 * chose that exact value. A derived slug gets a numeric suffix instead: two projects can
 * legitimately share a title, and failing the save would be unhelpful.
 */
async function resolveSlug(requested: string | null, title: string, id: number | null): Promise<string> {
  const taken = async (candidate: string) => {
    const { rowCount } = id
      ? await pool.query("SELECT 1 FROM project WHERE slug = $1 AND id <> $2 AND deleted_at IS NULL", [candidate, id])
      : await pool.query("SELECT 1 FROM project WHERE slug = $1 AND deleted_at IS NULL", [candidate]);
    return Boolean(rowCount);
  };

  if (requested?.trim()) {
    const slug = requested.trim();
    if (!isValidSlug(slug)) {
      throw new ValidationError("Slug must be lowercase alphanumeric words separated by single hyphens");
    }
    if (await taken(slug)) throw new ConflictError(`A project with slug '${slug}' already exists`);
    return slug;
  }

  const base = slugify(title);
  if (!base) throw new ValidationError("Could not derive a slug from the title; supply one explicitly");
  return uniqueSlug(base, taken);
}

async function require(id: number): Promise<Record<string, any>> {
  const { rows } = await pool.query("SELECT * FROM project WHERE id = $1 AND deleted_at IS NULL", [id]);
  if (!rows.length) throw new NotFoundError(`Project ${id} not found`);
  return rows[0]!;
}

async function technologiesFor(projectIds: number[]): Promise<Map<number, string[]>> {
  if (!projectIds.length) return new Map();
  const { rows } = await pool.query<{ project_id: number; name: string }>(
    `SELECT pt.project_id, t.name FROM project_technology pt
       JOIN technology t ON t.id = pt.technology_id
     WHERE pt.project_id = ANY($1::bigint[])`,
    [projectIds],
  );
  const byProject = new Map<number, string[]>();
  for (const row of rows) {
    byProject.set(row.project_id, [...(byProject.get(row.project_id) ?? []), row.name]);
  }
  for (const [key, names] of byProject) {
    byProject.set(key, names.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));
  }
  return byProject;
}

/** DATE columns arrive as plain strings now (see db/pool.ts); this only guards nulls. */
const asDate = (value: unknown) => value ?? null;

async function toSummaries(rows: Record<string, any>[]) {
  const technologies = await technologiesFor(rows.map((row) => row.id));
  const media = await mediaByIds(rows.map((row) => row.thumbnail_media_id).filter(Boolean));
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    shortDescription: row.short_description,
    thumbnail: media.get(row.thumbnail_media_id) ?? null,
    technologies: technologies.get(row.id) ?? [],
    featured: row.featured,
    projectType: row.project_type,
    startDate: asDate(row.start_date),
    endDate: asDate(row.end_date),
    displayOrder: row.display_order,
    status: row.status,
  }));
}

async function toDetail(row: Record<string, any>) {
  const [technologies, challenges, gallery] = await Promise.all([
    technologiesFor([row.id]),
    pool.query(
      "SELECT id, title, challenge, solution, display_order FROM project_challenge WHERE project_id = $1 ORDER BY display_order ASC, id ASC",
      [row.id],
    ),
    pool.query<{ media_id: number }>(
      "SELECT media_id FROM project_gallery WHERE project_id = $1 ORDER BY display_order ASC",
      [row.id],
    ),
  ]);

  const galleryIds = gallery.rows.map((item) => item.media_id);
  const media = await mediaByIds([...galleryIds, row.thumbnail_media_id].filter(Boolean));

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    shortDescription: row.short_description,
    detailedDescription: row.detailed_description,
    thumbnail: media.get(row.thumbnail_media_id) ?? null,
    githubUrl: row.github_url,
    liveUrl: row.live_url,
    projectType: row.project_type,
    startDate: asDate(row.start_date),
    endDate: asDate(row.end_date),
    featured: row.featured,
    status: row.status,
    displayOrder: row.display_order,
    features: row.features,
    aiVisible: row.ai_visible,
    technologies: technologies.get(row.id) ?? [],
    challenges: challenges.rows.map((block: any) => ({
      id: block.id,
      title: block.title,
      challenge: block.challenge,
      solution: block.solution,
      displayOrder: block.display_order,
    })),
    // Media deleted since the save simply drops out of the gallery (D-019).
    gallery: galleryIds.map((mediaId) => media.get(mediaId)).filter(Boolean),
    createdAt: row.created_at?.toISOString() ?? null,
    updatedAt: row.updated_at?.toISOString() ?? null,
  };
}
