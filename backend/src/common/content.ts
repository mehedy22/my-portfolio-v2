import { Router } from "express";
import type { ZodType } from "zod";
import { pool } from "../db/pool.js";
import { NotFoundError } from "./errors.js";
import { created, noContent, ok } from "./api.js";
import { handler, idParam, parseBody, queryString } from "./http.js";
import { requireMedia, mediaByIds, type MediaResponse } from "../modules/media/media.service.js";

/**
 * The four simple content modules — experience, education, certification, achievement — differ
 * only in their columns. Their behaviour does not: published-only public reads, all-statuses
 * admin reads with an optional filter, whole-row replace, soft delete, and a media reference that
 * tolerates the file having been deleted (D-019).
 *
 * <p>Written once here rather than four times, the way the frontend does the same for its forms.
 */
export type ContentColumn = {
  /** Database column. */
  column: string;
  /** Response/request field. camelCase. */
  field: string;
  /** Values arriving as `undefined` become NULL; booleans default to false. */
  type?: "text" | "date" | "boolean" | "int";
};

export type ContentModuleConfig<T> = {
  table: string;
  /** Public route, e.g. "experience" or "certifications". */
  publicPath: string;
  /** Admin route, when it differs from the public one. */
  adminPath?: string;
  columns: ContentColumn[];
  /** Media FK column, if the module has one, plus the request field that sets it. */
  mediaColumn?: { column: string; field: string; responseField: string };
  /** Default status for new rows: DRAFT for Experience, PUBLISHED for the rest. */
  defaultStatus: "DRAFT" | "PUBLISHED";
  createSchema: ZodType<T>;
  updateSchema: ZodType<T>;
  /** Extra validation the columns cannot express (date ordering, mutually exclusive fields). */
  validate?: (values: Record<string, unknown>) => void;
  /** Runs inside the same transaction, for modules with a join table (Experience ↔ technology). */
  afterSave?: (id: number, body: Record<string, unknown>, sql: typeof pool) => Promise<void>;
  /** Enriches a mapped row, e.g. attaching technology names. */
  enrich?: (rows: Record<string, unknown>[]) => Promise<void>;
};

const ORDER = "ORDER BY display_order ASC, id DESC";

export function contentModule<T>(config: ContentModuleConfig<T>) {
  const adminPath = config.adminPath ?? config.publicPath;
  const publicRouter = Router();
  const adminRouter = Router();

  const selectable = [
    "id",
    ...config.columns.map((c) => c.column),
    ...(config.mediaColumn ? [config.mediaColumn.column] : []),
    "display_order",
    "status",
    "ai_visible",
    "created_at",
    "updated_at",
  ];

  async function mapRows(rows: Record<string, unknown>[]) {
    const mediaIds = config.mediaColumn
      ? rows.map((row) => row[config.mediaColumn!.column]).filter((id): id is number => typeof id === "number")
      : [];
    const media = await mediaByIds(mediaIds);

    const mapped = rows.map((row) => {
      const item: Record<string, unknown> = { id: row.id };
      for (const column of config.columns) {
        item[column.field] = normalize(row[column.column], column.type);
      }
      if (config.mediaColumn) {
        const id = row[config.mediaColumn.column];
        // A deleted media row simply reads back as null rather than breaking the page (D-019).
        item[config.mediaColumn.responseField] =
          typeof id === "number" ? (media.get(id) as MediaResponse | undefined) ?? null : null;
      }
      item.displayOrder = row.display_order;
      item.status = row.status;
      item.aiVisible = row.ai_visible;
      item.createdAt = (row.created_at as Date)?.toISOString() ?? null;
      item.updatedAt = (row.updated_at as Date)?.toISOString() ?? null;
      return item;
    });

    await config.enrich?.(mapped);
    return mapped;
  }

  async function findAll(status?: string) {
    const where = status ? "WHERE deleted_at IS NULL AND status = $1" : "WHERE deleted_at IS NULL";
    const { rows } = await pool.query(
      `SELECT ${selectable.join(", ")} FROM ${config.table} ${where} ${ORDER}`,
      status ? [status] : [],
    );
    return mapRows(rows);
  }

  async function findOne(id: number) {
    const { rows } = await pool.query(
      `SELECT ${selectable.join(", ")} FROM ${config.table} WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (!rows.length) throw new NotFoundError(`${label(config.table)} ${id} not found`);
    return (await mapRows(rows))[0]!;
  }

  async function write(id: number | null, body: Record<string, unknown>) {
    config.validate?.(body);
    const mediaId = config.mediaColumn
      ? await requireMedia(body[config.mediaColumn.field] as number | null, config.mediaColumn.field)
      : null;

    const columns = [...config.columns.map((c) => c.column), "display_order", "status", "ai_visible"];
    const values: unknown[] = [
      ...config.columns.map((c) => coerce(body[c.field], c.type)),
      (body.displayOrder as number) ?? 0,
      (body.status as string) ?? (id ? undefined : config.defaultStatus),
      body.aiVisible === true,
    ];
    if (config.mediaColumn) {
      columns.splice(config.columns.length, 0, config.mediaColumn.column);
      values.splice(config.columns.length, 0, mediaId);
    }

    // An update that omits `status` must not blank it; keep the stored value.
    const statusIndex = columns.indexOf("status");
    if (values[statusIndex] === undefined) {
      const current = await pool.query<{ status: string }>(
        `SELECT status FROM ${config.table} WHERE id = $1`,
        [id],
      );
      values[statusIndex] = current.rows[0]?.status ?? config.defaultStatus;
    }

    const saved = id
      ? await pool.query<{ id: number }>(
          `UPDATE ${config.table} SET ${columns.map((c, i) => `${c} = $${i + 1}`).join(", ")},
             updated_at = now()
           WHERE id = $${columns.length + 1} AND deleted_at IS NULL RETURNING id`,
          [...values, id],
        )
      : await pool.query<{ id: number }>(
          `INSERT INTO ${config.table} (${columns.join(", ")})
           VALUES (${columns.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING id`,
          values,
        );

    if (!saved.rows.length) throw new NotFoundError(`${label(config.table)} ${id} not found`);
    const savedId = saved.rows[0]!.id;
    await config.afterSave?.(savedId, body, pool);
    return findOne(savedId);
  }

  publicRouter.get(
    `/${config.publicPath}`,
    handler(async (_req, res) => ok(res, await findAll("PUBLISHED"))),
  );

  adminRouter.get(
    `/admin/${adminPath}`,
    handler(async (req, res) => ok(res, await findAll(queryString(req, "status")))),
  );

  adminRouter.get(
    `/admin/${adminPath}/:id`,
    handler(async (req, res) => ok(res, await findOne(idParam(req)))),
  );

  adminRouter.post(
    `/admin/${adminPath}`,
    handler(async (req, res) => {
      const body = parseBody(config.createSchema, req.body) as Record<string, unknown>;
      return created(res, await write(null, body), `${label(config.table)} created`);
    }),
  );

  adminRouter.put(
    `/admin/${adminPath}/:id`,
    handler(async (req, res) => {
      const body = parseBody(config.updateSchema, req.body) as Record<string, unknown>;
      return ok(res, await write(idParam(req), body), `${label(config.table)} updated`);
    }),
  );

  adminRouter.delete(
    `/admin/${adminPath}/:id`,
    handler(async (req, res) => {
      const { rowCount } = await pool.query(
        `UPDATE ${config.table} SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`,
        [idParam(req)],
      );
      if (!rowCount) throw new NotFoundError(`${label(config.table)} ${idParam(req)} not found`);
      return noContent(res);
    }),
  );

  return { publicRouter, adminRouter };
}

function coerce(value: unknown, type: ContentColumn["type"]): unknown {
  if (type === "boolean") return value === true;
  if (value === undefined || value === "") return null;
  return value;
}

function normalize(value: unknown, _type: ContentColumn["type"]): unknown {
  // DATE columns already arrive as "YYYY-MM-DD" strings (see the parser in db/pool.ts);
  // TIMESTAMPTZ still arrives as a Date and serializes as a full instant.
  if (value instanceof Date) return value.toISOString();
  return value ?? null;
}

function label(table: string): string {
  return table.charAt(0).toUpperCase() + table.slice(1).replace(/_/g, " ");
}
