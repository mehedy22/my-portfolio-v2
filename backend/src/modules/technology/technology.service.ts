import type { Sql } from "../../db/pool.js";
import { pool } from "../../db/pool.js";
import { ValidationError } from "../../common/errors.js";
import { slugify } from "../../common/slug.js";

/**
 * Resolve-or-create by name (D-020): the payload carries names, not ids, because Phase 7 defines
 * no endpoint from which the admin could obtain an id. Matching is case-insensitive, backed by
 * `uq_technology_name_lower` — without it "Redis" and "redis" become two rows and the join this
 * table was normalized for silently returns half the answer.
 */
export async function resolveTechnologies(names: string[] | undefined, sql: Sql = pool): Promise<number[]> {
  return resolveNamed(names, "technology", sql);
}

/** Skill categories follow the same rule for the same reason (D-022). */
export async function resolveSkillCategory(name: string, sql: Sql = pool): Promise<number> {
  const [id] = await resolveNamed([name], "skill_category", sql);
  if (id === undefined) throw new ValidationError("A category is required");
  return id;
}

async function resolveNamed(
  names: string[] | undefined,
  table: "technology" | "skill_category",
  sql: Sql,
): Promise<number[]> {
  if (!names?.length) return [];

  const seen = new Set<string>();
  const cleaned = names
    .filter((name) => typeof name === "string" && name.trim())
    .map((name) => name.trim().replace(/\s+/g, " "))
    .filter((name) => {
      if (name.length > 100) {
        throw new ValidationError(`${table === "technology" ? "Technology" : "Category"} name must be at most 100 characters`);
      }
      const key = name.toLowerCase();
      return seen.has(key) ? false : (seen.add(key), true);
    });

  const ids: number[] = [];
  for (const name of cleaned) {
    const existing = await sql.query<{ id: number }>(
      `SELECT id FROM ${table} WHERE lower(name) = lower($1)`,
      [name],
    );
    if (existing.rows[0]) {
      ids.push(existing.rows[0].id);
      continue;
    }
    const inserted = await sql.query<{ id: number }>(
      `INSERT INTO ${table} (name) VALUES ($1) RETURNING id`,
      [name],
    );
    ids.push(inserted.rows[0]!.id);
  }
  return ids;
}

/** Taxonomies that carry a slug (blog category/tag) need one generated alongside the name. */
export async function resolveTaxonomy(
  name: string | null | undefined,
  table: "category" | "tag",
  sql: Sql = pool,
): Promise<number | null> {
  if (!name?.trim()) return null;
  const clean = name.trim().replace(/\s+/g, " ");

  const existing = await sql.query<{ id: number }>(
    `SELECT id FROM ${table} WHERE lower(name) = lower($1)`,
    [clean],
  );
  if (existing.rows[0]) return existing.rows[0].id;

  const base = slugify(clean) || `item-${Date.now()}`;
  let slug = base;
  let suffix = 2;
  // Slugs are unique per taxonomy table; suffix rather than fail on a clash.
  while ((await sql.query(`SELECT 1 FROM ${table} WHERE slug = $1`, [slug])).rowCount) {
    slug = `${base}-${suffix++}`;
  }
  const inserted = await sql.query<{ id: number }>(
    `INSERT INTO ${table} (name, slug) VALUES ($1, $2) RETURNING id`,
    [clean, slug],
  );
  return inserted.rows[0]!.id;
}

export async function listTaxonomy(table: "category" | "tag" | "skill_category") {
  const hasSlug = table !== "skill_category";
  const { rows } = await pool.query(
    `SELECT id, name${hasSlug ? ", slug" : ""} FROM ${table} ORDER BY name ASC`,
  );
  return rows;
}
