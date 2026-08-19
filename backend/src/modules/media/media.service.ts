import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, unlink, writeFile, stat } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { env } from "../../config/env.js";
import { pool } from "../../db/pool.js";
import { NotFoundError, ValidationError } from "../../common/errors.js";
import { page, pageParams, type PageResponse } from "../../common/api.js";
import { detectFileType, readDimensions } from "./fileType.js";

export type MediaResponse = {
  id: number;
  url: string;
  fileName: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  storageBackend: "LOCAL" | "OBJECT_STORAGE";
  width: number | null;
  height: number | null;
  altText: string | null;
  createdAt: string;
};

type MediaRow = {
  id: number;
  file_name: string;
  original_file_name: string;
  mime_type: string;
  size_bytes: number;
  storage_backend: "LOCAL" | "OBJECT_STORAGE";
  storage_path_or_url: string;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  created_at: Date;
};

/** The one place the public content path is constructed. */
const urlFor = (id: number) => `/api/v1/media/${id}/content`;

const STORAGE_ROOT = resolve(env.media.storageRoot);

export function toMediaResponse(row: MediaRow | null | undefined): MediaResponse | null {
  if (!row) return null;
  return {
    id: row.id,
    url: urlFor(row.id),
    fileName: row.file_name,
    originalFileName: row.original_file_name,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    storageBackend: row.storage_backend,
    width: row.width,
    height: row.height,
    altText: row.alt_text,
    createdAt: row.created_at.toISOString(),
  };
}

/**
 * Upload pipeline, in order: sniff the real type → enforce the per-type size limit → require alt
 * text for images → generate a storage name → write → record the row.
 *
 * <p>The client's filename and Content-Type never influence any of it; they are recorded for
 * display only.
 */
export async function upload(
  file: { buffer: Buffer; originalname: string },
  altTextRaw: string | undefined,
  adminId: number,
): Promise<MediaResponse> {
  if (!file?.buffer?.length) throw new ValidationError("A file is required");

  const type = detectFileType(file.buffer);
  if (!type) {
    throw new ValidationError(
      "Unsupported file type. Allowed: JPEG, PNG, GIF, WebP images and PDF documents",
    );
  }

  const limit = type.isImage ? env.media.maxImageBytes : env.media.maxDocumentBytes;
  if (file.buffer.length > limit) {
    throw new ValidationError(
      `File exceeds the ${Math.round(limit / (1024 * 1024))} MB limit for ${
        type.isImage ? "image" : "document"
      } uploads`,
    );
  }

  const altText = altTextRaw?.trim() ? altTextRaw.trim() : null;
  if (altText && altText.length > 300) {
    throw new ValidationError("Alt text must be at most 300 characters");
  }
  // Images must describe themselves; documents are exempt (Sprint 8 accessibility rule).
  if (type.isImage && !altText) {
    throw new ValidationError("Alt text is required for images so screen readers can describe them");
  }

  const storageName = `${randomUUID()}.${type.extension}`;
  const locator = await store(storageName, file.buffer);
  const dimensions = type.isImage ? readDimensions(file.buffer, type) : null;

  const { rows } = await pool.query<MediaRow>(
    `INSERT INTO media (file_name, original_file_name, mime_type, size_bytes, storage_backend,
                        storage_path_or_url, width, height, alt_text, uploaded_by_admin_id)
     VALUES ($1, $2, $3, $4, 'LOCAL', $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      storageName,
      displayName(file.originalname),
      type.mimeType,
      file.buffer.length,
      locator,
      dimensions?.width ?? null,
      dimensions?.height ?? null,
      altText,
      adminId,
    ],
  );
  console.info(`Media uploaded: id=${rows[0]!.id} type=${type.mimeType} bytes=${file.buffer.length}`);
  return toMediaResponse(rows[0])!;
}

export async function list(query: Record<string, unknown>): Promise<PageResponse<MediaResponse>> {
  const { page: pageNumber, size, offset } = pageParams(query, 20, 100);
  const { rows } = await pool.query<MediaRow>(
    "SELECT * FROM media WHERE deleted_at IS NULL ORDER BY created_at DESC, id DESC LIMIT $1 OFFSET $2",
    [size, offset],
  );
  const { rows: counted } = await pool.query<{ count: string }>(
    "SELECT count(*) FROM media WHERE deleted_at IS NULL",
  );
  return page(rows.map((row) => toMediaResponse(row)!), pageNumber, size, Number(counted[0]!.count));
}

/**
 * Soft-deletes the row and removes the stored bytes.
 *
 * <p>Never 409s on a referenced file: `media` is owner-agnostic, so it cannot know its referrers
 * (D-019). The bytes go because keeping the file of a "deleted" image would leave it fetchable by
 * anyone who already knew its URL.
 */
export async function remove(id: number): Promise<void> {
  const { rows } = await pool.query<MediaRow>(
    "UPDATE media SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING *",
    [id],
  );
  const row = rows[0];
  if (!row) throw new NotFoundError(`Media ${id} not found`);

  const path = resolveInsideRoot(row.storage_path_or_url);
  if (path) {
    // The row is already soft-deleted; an orphaned file is untidy, not incorrect.
    await unlink(path).catch(() => undefined);
  }
  console.info(`Media deleted: id=${id}`);
}

export async function loadContent(id: number) {
  const { rows } = await pool.query<MediaRow>(
    "SELECT * FROM media WHERE id = $1 AND deleted_at IS NULL",
    [id],
  );
  const row = rows[0];
  if (!row) throw new NotFoundError(`Media ${id} not found`);

  const path = resolveInsideRoot(row.storage_path_or_url);
  if (!path || !(await stat(path).catch(() => null))) {
    // A row without bytes is a storage inconsistency worth an operator's attention; the caller
    // still just gets a 404.
    console.error(`Media row ${id} has no readable file at its recorded location`);
    throw new NotFoundError(`Media ${id} not found`);
  }
  return {
    stream: createReadStream(path),
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    originalFileName: row.original_file_name,
  };
}

/** Resolves a media id a content module points at, rejecting the write when it does not exist. */
export async function requireMedia(id: number | null | undefined, field: string): Promise<number | null> {
  if (id === null || id === undefined) return null;
  const { rows } = await pool.query("SELECT 1 FROM media WHERE id = $1 AND deleted_at IS NULL", [id]);
  if (!rows.length) throw new ValidationError(`${field} references media ${id}, which does not exist`);
  return id;
}

/** Loads media rows for a set of ids, silently omitting any that no longer exist (D-019). */
export async function mediaByIds(ids: number[]): Promise<Map<number, MediaResponse>> {
  if (!ids.length) return new Map();
  const { rows } = await pool.query<MediaRow>(
    "SELECT * FROM media WHERE id = ANY($1::bigint[]) AND deleted_at IS NULL",
    [ids],
  );
  return new Map(rows.map((row) => [row.id, toMediaResponse(row)!]));
}

// --------------------------------------------------------------- storage

/**
 * Local filesystem backend. Files are sharded into `yyyy/MM/` so the root does not degrade into
 * one directory with thousands of entries.
 */
async function store(fileName: string, content: Buffer): Promise<string> {
  const now = new Date();
  const relative = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${fileName}`;
  const target = resolveInsideRoot(relative);
  if (!target) throw new Error("Generated storage path escapes the media root");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
  return relative;
}

/**
 * Every locator is re-resolved against the root and checked to still be inside it. The names this
 * module generates cannot escape; this check is what stops a corrupted or hand-edited
 * `storage_path_or_url` from becoming an arbitrary-file read.
 */
function resolveInsideRoot(locator: string): string | null {
  if (!locator?.trim()) return null;
  const candidate = resolve(join(STORAGE_ROOT, locator));
  return candidate === STORAGE_ROOT || candidate.startsWith(STORAGE_ROOT + sep) ? candidate : null;
}

/**
 * Kept for display only. Any directory component is stripped rather than trusted: browsers are
 * supposed to send a bare name, but the part header is client-controlled.
 */
function displayName(submitted: string | undefined): string {
  if (!submitted?.trim()) return "unnamed";
  const bare = submitted.replace(/\\/g, "/").split("/").pop()?.trim();
  return bare && bare.length ? bare.slice(0, 255) : "unnamed";
}
