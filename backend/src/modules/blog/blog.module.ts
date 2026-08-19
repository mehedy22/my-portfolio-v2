import { Router } from "express";
import sanitizeHtml from "sanitize-html";
import { z } from "zod";
import { pool, transaction } from "../../db/pool.js";
import { ConflictError, NotFoundError, ValidationError } from "../../common/errors.js";
import { created, noContent, ok, page, pageParams } from "../../common/api.js";
import { handler, parseBody, queryString, idParam } from "../../common/http.js";
import { isValidSlug, slugify, uniqueSlug } from "../../common/slug.js";
import { mediaByIds, requireMedia } from "../media/media.service.js";
import { listTaxonomy, resolveTaxonomy } from "../technology/technology.service.js";

const STATUSES = ["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"] as const;
/** Roughly the average adult reading pace; only ever used as an estimate. */
const WORDS_PER_MINUTE = 200;

/**
 * Allow-list sanitization for the one genuinely rich-text field in the system (D-027).
 *
 * <p>Applied on **write**, not render: the database can then never hold a payload waiting for the
 * one code path that forgets to escape it, and every future consumer inherits the guarantee.
 * No script, style, iframe, form or event handlers; links forced to nofollow and http/https, so a
 * `javascript:` URL cannot survive.
 */
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "hr", "strong", "b", "em", "i", "u", "s", "blockquote", "code", "pre",
    "h2", "h3", "h4", "ul", "ol", "li", "a", "img", "figure", "figcaption",
    "table", "thead", "tbody", "tr", "th", "td",
  ],
  allowedAttributes: {
    a: ["href"],
    img: ["src", "alt", "title"],
    code: ["class"],
    pre: ["class"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "nofollow noopener noreferrer" }),
  },
  disallowedTagsMode: "discard",
};

const schema = z.object({
  title: z.string().trim().min(1, "must not be blank").max(250),
  slug: z.string().max(270).nullish(),
  excerpt: z.string().max(500).nullish(),
  content: z.string().min(1, "must not be blank"),
  thumbnailMediaId: z.number().nullish(),
  ogImageMediaId: z.number().nullish(),
  category: z.string().max(100).nullish(),
  tags: z.array(z.string()).nullish(),
  status: z.enum(STATUSES).nullish(),
  publishedAt: z.string().nullish(),
  seoTitle: z.string().max(200).nullish(),
  seoDescription: z.string().max(300).nullish(),
  aiVisible: z.boolean().nullish(),
});

export const blogPublicRouter = Router();
export const blogAdminRouter = Router();

// --------------------------------------------------------------- public

/**
 * "Published" on the public side means PUBLISHED *and* already due: a scheduled article stays
 * invisible until the moment arrives, without anyone running a job to flip it.
 */
blogPublicRouter.get(
  "/articles",
  handler(async (req, res) => {
    const { page: pageNumber, size, offset } = pageParams(req.query, 10, 100);
    const category = queryString(req, "category") ?? null;
    const tag = queryString(req, "tag") ?? null;
    const search = queryString(req, "search") ?? "";

    // LEFT JOIN, not the implicit path: an inner join would silently drop every uncategorised
    // article from the public list.
    const from = `
      FROM article a
      LEFT JOIN category c ON c.id = a.category_id
      WHERE a.deleted_at IS NULL AND a.status = 'PUBLISHED' AND a.published_at <= now()
        AND ($1::text IS NULL OR c.slug = $1)
        AND ($2::text IS NULL OR EXISTS (
              SELECT 1 FROM article_tag at JOIN tag t ON t.id = at.tag_id
              WHERE at.article_id = a.id AND t.slug = $2))
        AND ($3 = '' OR lower(a.title) LIKE lower('%' || $3 || '%')
                     OR lower(coalesce(a.excerpt, '')) LIKE lower('%' || $3 || '%'))`;

    const { rows } = await pool.query(
      `SELECT a.* ${from} ORDER BY a.published_at DESC LIMIT $4 OFFSET $5`,
      [category, tag, search, size, offset],
    );
    const { rows: counted } = await pool.query<{ count: string }>(
      `SELECT count(*) ${from}`,
      [category, tag, search],
    );
    return ok(res, page(await toSummaries(rows), pageNumber, size, Number(counted[0]!.count)));
  }),
);

blogPublicRouter.get(
  "/articles/categories",
  handler(async (_req, res) => ok(res, await listTaxonomy("category"))),
);

blogPublicRouter.get(
  "/articles/tags",
  handler(async (_req, res) => ok(res, await listTaxonomy("tag"))),
);

blogPublicRouter.get(
  "/articles/:slug",
  handler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT * FROM article WHERE slug = $1 AND deleted_at IS NULL
         AND status = 'PUBLISHED' AND published_at <= now()`,
      [req.params.slug],
    );
    // A draft, a scheduled article that is not due, and a nonexistent slug are all the same 404 —
    // the public API never confirms that something merely isn't ready yet.
    if (!rows.length) throw new NotFoundError(`Article '${req.params.slug}' not found`);
    return ok(res, await toDetail(rows[0]!));
  }),
);

// ---------------------------------------------------------------- admin

blogAdminRouter.get(
  "/admin/articles",
  handler(async (req, res) => {
    const { page: pageNumber, size, offset } = pageParams(req.query, 20, 100);
    const status = queryString(req, "status");
    const where = status ? "WHERE deleted_at IS NULL AND status = $1" : "WHERE deleted_at IS NULL";
    const params = status ? [status] : [];

    const { rows } = await pool.query(
      `SELECT * FROM article ${where} ORDER BY published_at DESC NULLS LAST, id DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, size, offset],
    );
    const { rows: counted } = await pool.query<{ count: string }>(
      `SELECT count(*) FROM article ${where}`,
      params,
    );
    return ok(res, page(await toSummaries(rows), pageNumber, size, Number(counted[0]!.count)));
  }),
);

blogAdminRouter.get(
  "/admin/articles/:id",
  handler(async (req, res) => ok(res, await toDetail(await require(idParam(req))))),
);

blogAdminRouter.post(
  "/admin/articles",
  handler(async (req, res) => {
    const body = parseBody(schema, req.body);
    const id = await write(null, body, req.adminId!);
    return created(res, await toDetail(await require(id)), "Article created");
  }),
);

blogAdminRouter.put(
  "/admin/articles/:id",
  handler(async (req, res) => {
    const id = idParam(req);
    await require(id);
    await write(id, parseBody(schema, req.body), null);
    return ok(res, await toDetail(await require(id)), "Article updated");
  }),
);

blogAdminRouter.delete(
  "/admin/articles/:id",
  handler(async (req, res) => {
    const { rowCount } = await pool.query(
      "UPDATE article SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL",
      [idParam(req)],
    );
    if (!rowCount) throw new NotFoundError(`Article ${idParam(req)} not found`);
    return noContent(res);
  }),
);

blogAdminRouter.get(
  "/admin/categories",
  handler(async (_req, res) => ok(res, await listTaxonomy("category"))),
);

blogAdminRouter.get(
  "/admin/tags",
  handler(async (_req, res) => ok(res, await listTaxonomy("tag"))),
);

// -------------------------------------------------------------- helpers

type Body = z.infer<typeof schema>;

async function write(id: number | null, body: Body, authorAdminId: number | null): Promise<number> {
  const status = body.status ?? "DRAFT";
  let publishedAt = body.publishedAt ? new Date(body.publishedAt) : null;

  if (status === "PUBLISHED" || status === "SCHEDULED") {
    // Mirrors ck_article_published_at; publishing "now" is the obvious default rather than an
    // error the admin has to decode.
    publishedAt = publishedAt ?? new Date();
  }
  if (status === "SCHEDULED" && publishedAt! <= new Date()) {
    throw new ValidationError("A scheduled article needs a publication time in the future");
  }

  const content = sanitizeHtml(body.content, SANITIZE_OPTIONS);
  if (!content.trim()) {
    throw new ValidationError("Content is empty once unsafe markup is removed");
  }

  const slug = await resolveSlug(body.slug ?? null, body.title, id);
  const thumbnailId = await requireMedia(body.thumbnailMediaId ?? null, "thumbnailMediaId");
  const ogImageId = await requireMedia(body.ogImageMediaId ?? null, "ogImageMediaId");

  return transaction(async (client) => {
    const categoryId = await resolveTaxonomy(body.category ?? null, "category", client);
    const values = [
      body.title.trim(),
      slug,
      body.excerpt?.trim() || null,
      content,
      thumbnailId,
      ogImageId,
      categoryId,
      status,
      publishedAt,
      readingTime(content),
      body.seoTitle?.trim() || null,
      body.seoDescription?.trim() || null,
      body.aiVisible === true,
    ];

    let articleId: number;
    try {
      if (id) {
        await client.query(
          `UPDATE article SET title=$1, slug=$2, excerpt=$3, content=$4, thumbnail_media_id=$5,
                  og_image_media_id=$6, category_id=$7, status=$8, published_at=$9,
                  reading_time_minutes=$10, seo_title=$11, seo_description=$12, ai_visible=$13,
                  updated_at=now()
           WHERE id=$14`,
          [...values, id],
        );
        articleId = id;
      } else {
        const inserted = await client.query<{ id: number }>(
          `INSERT INTO article (title, slug, excerpt, content, thumbnail_media_id, og_image_media_id,
                                category_id, status, published_at, reading_time_minutes,
                                seo_title, seo_description, ai_visible, author_admin_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
          [...values, authorAdminId],
        );
        articleId = inserted.rows[0]!.id;
      }
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        throw new ConflictError(`An article with slug '${slug}' already exists`);
      }
      throw error;
    }

    await client.query("DELETE FROM article_tag WHERE article_id = $1", [articleId]);
    const seen = new Set<string>();
    for (const raw of body.tags ?? []) {
      if (!raw?.trim()) continue;
      const name = raw.trim().replace(/\s+/g, " ");
      if (seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      const tagId = await resolveTaxonomy(name, "tag", client);
      if (tagId) {
        await client.query("INSERT INTO article_tag (article_id, tag_id) VALUES ($1, $2)", [articleId, tagId]);
      }
    }
    return articleId;
  });
}

/** Estimated from the sanitized text, so markup is not counted as words. */
function readingTime(html: string): number {
  const words = html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

async function resolveSlug(requested: string | null, title: string, id: number | null): Promise<string> {
  const taken = async (candidate: string) => {
    const { rowCount } = id
      ? await pool.query("SELECT 1 FROM article WHERE slug = $1 AND id <> $2 AND deleted_at IS NULL", [candidate, id])
      : await pool.query("SELECT 1 FROM article WHERE slug = $1 AND deleted_at IS NULL", [candidate]);
    return Boolean(rowCount);
  };

  if (requested?.trim()) {
    const slug = requested.trim();
    if (!isValidSlug(slug)) {
      throw new ValidationError("Slug must be lowercase alphanumeric words separated by single hyphens");
    }
    if (await taken(slug)) throw new ConflictError(`An article with slug '${slug}' already exists`);
    return slug;
  }
  const base = slugify(title);
  if (!base) throw new ValidationError("Could not derive a slug from the title; supply one explicitly");
  return uniqueSlug(base, taken);
}

async function require(id: number): Promise<Record<string, any>> {
  const { rows } = await pool.query("SELECT * FROM article WHERE id = $1 AND deleted_at IS NULL", [id]);
  if (!rows.length) throw new NotFoundError(`Article ${id} not found`);
  return rows[0]!;
}

async function tagsFor(articleIds: number[]): Promise<Map<number, string[]>> {
  if (!articleIds.length) return new Map();
  const { rows } = await pool.query<{ article_id: number; name: string }>(
    `SELECT at.article_id, t.name FROM article_tag at JOIN tag t ON t.id = at.tag_id
     WHERE at.article_id = ANY($1::bigint[])`,
    [articleIds],
  );
  const byArticle = new Map<number, string[]>();
  for (const row of rows) {
    byArticle.set(row.article_id, [...(byArticle.get(row.article_id) ?? []), row.name]);
  }
  for (const [key, names] of byArticle) {
    byArticle.set(key, names.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));
  }
  return byArticle;
}

async function categoryNames(ids: number[]): Promise<Map<number, string>> {
  if (!ids.length) return new Map();
  const { rows } = await pool.query<{ id: number; name: string }>(
    "SELECT id, name FROM category WHERE id = ANY($1::bigint[])",
    [ids],
  );
  return new Map(rows.map((row) => [row.id, row.name]));
}

async function toSummaries(rows: Record<string, any>[]) {
  const tags = await tagsFor(rows.map((row) => row.id));
  const categories = await categoryNames(rows.map((row) => row.category_id).filter(Boolean));
  const media = await mediaByIds(rows.map((row) => row.thumbnail_media_id).filter(Boolean));
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    thumbnail: media.get(row.thumbnail_media_id) ?? null,
    category: row.category_id ? categories.get(row.category_id) ?? null : null,
    tags: tags.get(row.id) ?? [],
    status: row.status,
    publishedAt: row.published_at?.toISOString() ?? null,
    readingTimeMinutes: row.reading_time_minutes,
  }));
}

async function toDetail(row: Record<string, any>) {
  const tags = await tagsFor([row.id]);
  const categories = await categoryNames([row.category_id].filter(Boolean));
  const media = await mediaByIds([row.thumbnail_media_id, row.og_image_media_id].filter(Boolean));
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    content: row.content,
    thumbnail: media.get(row.thumbnail_media_id) ?? null,
    ogImage: media.get(row.og_image_media_id) ?? null,
    category: row.category_id ? categories.get(row.category_id) ?? null : null,
    tags: tags.get(row.id) ?? [],
    status: row.status,
    publishedAt: row.published_at?.toISOString() ?? null,
    readingTimeMinutes: row.reading_time_minutes,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    aiVisible: row.ai_visible,
    createdAt: row.created_at?.toISOString() ?? null,
    updatedAt: row.updated_at?.toISOString() ?? null,
  };
}
