import { Router } from "express";
import { z } from "zod";
import { pool } from "../../db/pool.js";
import { NotFoundError } from "../../common/errors.js";
import { created, noContent, ok } from "../../common/api.js";
import { handler, parseBody, queryString, idParam } from "../../common/http.js";
import { listTaxonomy, resolveSkillCategory } from "../technology/technology.service.js";

/**
 * Skills do not use the shared content factory: the public endpoint returns them **grouped by
 * category**, which is a different shape from every other module, and the category is a resolved
 * lookup rather than a plain column.
 */
const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
const PROFICIENCIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"] as const;

const schema = z.object({
  name: z.string().trim().min(1, "must not be blank").max(100),
  category: z.string().trim().min(1, "must not be blank").max(100),
  proficiency: z.enum(PROFICIENCIES).nullish(),
  icon: z.string().max(200).nullish(),
  displayOrder: z.number().int().nullish(),
  featured: z.boolean().nullish(),
  status: z.enum(STATUSES).nullish(),
  aiVisible: z.boolean().nullish(),
});

type SkillRow = {
  id: number;
  name: string;
  category: string;
  proficiency: string | null;
  icon: string | null;
  display_order: number;
  featured: boolean;
  status: string;
  ai_visible: boolean;
  created_at: Date;
  updated_at: Date;
};

const SELECT = `
  SELECT s.id, s.name, c.name AS category, s.proficiency, s.icon, s.display_order,
         s.featured, s.status, s.ai_visible, s.created_at, s.updated_at
  FROM skill s JOIN skill_category c ON c.id = s.category_id
  WHERE s.deleted_at IS NULL`;

const toResponse = (row: SkillRow) => ({
  id: row.id,
  name: row.name,
  category: row.category,
  proficiency: row.proficiency,
  icon: row.icon,
  displayOrder: row.display_order,
  featured: row.featured,
  status: row.status,
  aiVisible: row.ai_visible,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

export const skillPublicRouter = Router();
export const skillAdminRouter = Router();

skillPublicRouter.get(
  "/skills",
  handler(async (_req, res) => {
    const { rows } = await pool.query<SkillRow>(
      `${SELECT} AND s.status = 'PUBLISHED' ORDER BY s.display_order ASC, s.id DESC`,
    );
    // Grouped once server-side rather than leaving every client to re-derive it.
    const groups = new Map<string, ReturnType<typeof toResponse>[]>();
    for (const row of rows) {
      groups.set(row.category, [...(groups.get(row.category) ?? []), toResponse(row)]);
    }
    const grouped = [...groups.entries()]
      .sort(([a], [b]) => a.toLowerCase().localeCompare(b.toLowerCase()))
      .map(([category, skills]) => ({ category, skills }));
    return ok(res, grouped);
  }),
);

skillAdminRouter.get(
  "/admin/skills",
  handler(async (req, res) => {
    const status = queryString(req, "status");
    const { rows } = await pool.query<SkillRow>(
      `${SELECT} ${status ? "AND s.status = $1" : ""} ORDER BY s.display_order ASC, s.id DESC`,
      status ? [status] : [],
    );
    return ok(res, rows.map(toResponse));
  }),
);

skillAdminRouter.get(
  "/admin/skills/:id",
  handler(async (req, res) => ok(res, await findOne(idParam(req)))),
);

skillAdminRouter.post(
  "/admin/skills",
  handler(async (req, res) => {
    const body = parseBody(schema, req.body);
    const categoryId = await resolveSkillCategory(body.category);
    const { rows } = await pool.query<{ id: number }>(
      `INSERT INTO skill (name, category_id, proficiency, icon, display_order, featured, status, ai_visible)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [
        body.name,
        categoryId,
        body.proficiency ?? null,
        body.icon ?? null,
        body.displayOrder ?? 0,
        body.featured === true,
        body.status ?? "PUBLISHED",
        body.aiVisible === true,
      ],
    );
    return created(res, await findOne(rows[0]!.id), "Skill created");
  }),
);

skillAdminRouter.put(
  "/admin/skills/:id",
  handler(async (req, res) => {
    const id = idParam(req);
    const body = parseBody(schema, req.body);
    const categoryId = await resolveSkillCategory(body.category);
    const { rowCount } = await pool.query(
      `UPDATE skill SET name = $1, category_id = $2, proficiency = $3, icon = $4,
              display_order = $5, featured = $6, status = coalesce($7, status), ai_visible = $8,
              updated_at = now()
       WHERE id = $9 AND deleted_at IS NULL`,
      [
        body.name,
        categoryId,
        body.proficiency ?? null,
        body.icon ?? null,
        body.displayOrder ?? 0,
        body.featured === true,
        body.status ?? null,
        body.aiVisible === true,
        id,
      ],
    );
    if (!rowCount) throw new NotFoundError(`Skill ${id} not found`);
    return ok(res, await findOne(id), "Skill updated");
  }),
);

skillAdminRouter.delete(
  "/admin/skills/:id",
  handler(async (req, res) => {
    const { rowCount } = await pool.query(
      "UPDATE skill SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL",
      [idParam(req)],
    );
    if (!rowCount) throw new NotFoundError(`Skill ${idParam(req)} not found`);
    return noContent(res);
  }),
);

skillAdminRouter.get(
  "/admin/skill-categories",
  handler(async (_req, res) => ok(res, await listTaxonomy("skill_category"))),
);

async function findOne(id: number) {
  const { rows } = await pool.query<SkillRow>(`${SELECT} AND s.id = $1`, [id]);
  if (!rows.length) throw new NotFoundError(`Skill ${id} not found`);
  return toResponse(rows[0]!);
}
