import { createReadStream } from "node:fs";
import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import type { Readable } from "node:stream";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { env } from "../../config/env.js";

/**
 * Where uploaded bytes live.
 *
 * <p>Two backends, chosen by configuration and recorded per row in `media.storage_backend` — the
 * column has allowed `'LOCAL' | 'OBJECT_STORAGE'` since V2, and this is what finally uses it. Rows
 * are read through the backend they were written with, so a store containing both kinds keeps
 * working and no migration of existing rows is required.
 *
 * <p>`LOCAL` was the only implementation until 2026-08-20, when it turned out to be the wrong one
 * for the deployment: the platform's instance filesystem is ephemeral, so every deploy discarded
 * every upload while the rows kept pointing at them — the site served broken images to everyone
 * whose browser had not cached them a year earlier (**D-042**, OPEN_QUESTIONS #11).
 */
export type StorageBackend = "LOCAL" | "OBJECT_STORAGE";

export interface MediaStorage {
  readonly backend: StorageBackend;
  /** Stores the bytes and returns the locator to record on the row. */
  save(fileName: string, content: Buffer, contentType: string): Promise<string>;
  /** Opens the stored bytes, or null when the locator no longer resolves to anything readable. */
  open(locator: string): Promise<Readable | null>;
  /** Best-effort removal. An orphaned object is untidy, not incorrect. */
  remove(locator: string): Promise<void>;
}

/** `yyyy/MM/name`, so neither a directory nor a bucket prefix collects thousands of siblings. */
function shardedKey(fileName: string): string {
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${now.getUTCFullYear()}/${month}/${fileName}`;
}

// ------------------------------------------------------------------ local

const STORAGE_ROOT = resolve(env.media.storageRoot);

/**
 * Every locator is re-resolved against the root and checked to still be inside it. The names this
 * module generates cannot escape; this check is what stops a corrupted or hand-edited
 * `storage_path_or_url` from becoming an arbitrary-file read.
 */
export function resolveInsideRoot(locator: string): string | null {
  if (!locator?.trim()) return null;
  const candidate = resolve(join(STORAGE_ROOT, locator));
  return candidate === STORAGE_ROOT || candidate.startsWith(STORAGE_ROOT + sep) ? candidate : null;
}

export const localStorage: MediaStorage = {
  backend: "LOCAL",

  async save(fileName, content) {
    const relative = shardedKey(fileName);
    const target = resolveInsideRoot(relative);
    if (!target) throw new Error("Generated storage path escapes the media root");
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
    return relative;
  },

  async open(locator) {
    const path = resolveInsideRoot(locator);
    if (!path || !(await stat(path).catch(() => null))) return null;
    return createReadStream(path);
  },

  async remove(locator) {
    const path = resolveInsideRoot(locator);
    if (path) await unlink(path).catch(() => undefined);
  },
};

// ---------------------------------------------------------- object storage

function s3Storage(): MediaStorage {
  const config = env.media.objectStorage;
  const client = new S3Client({
    region: config.region,
    // Absent for AWS itself, set for every S3-compatible provider (R2, B2, MinIO).
    endpoint: config.endpoint || undefined,
    forcePathStyle: config.forcePathStyle,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    /*
     * Required for Cloudflare R2, and harmless everywhere else.
     *
     * Since v3.729 this SDK defaults both of these to WHEN_SUPPORTED, which adds an
     * `x-amz-checksum-crc32` header to every upload. R2 does not implement those headers and
     * rejects the request outright — a 400 on the first upload, with a message about a header
     * "not implemented" that gives no hint it is an SDK default doing it. WHEN_REQUIRED sends a
     * checksum only where the API demands one, which is the behaviour every S3-compatible
     * provider actually supports. AWS itself is unaffected: integrity is still covered by the
     * request signature.
     */
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });

  return {
    backend: "OBJECT_STORAGE",

    async save(fileName, content, contentType) {
      const key = shardedKey(fileName);
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: content,
          ContentType: contentType,
        }),
      );
      return key;
    },

    async open(locator) {
      if (!locator?.trim()) return null;
      try {
        const result = await client.send(
          new GetObjectCommand({ Bucket: config.bucket, Key: locator }),
        );
        return (result.Body as Readable) ?? null;
      } catch (error) {
        // A missing key is the expected "no bytes" answer; anything else is worth an operator's
        // attention, because it means the bucket is misconfigured rather than the object absent.
        const name = (error as { name?: string })?.name;
        if (name === "NoSuchKey" || name === "NotFound") return null;
        console.error(`Object storage read failed for key ${locator}:`, error);
        return null;
      }
    },

    async remove(locator) {
      if (!locator?.trim()) return;
      await client
        .send(new DeleteObjectCommand({ Bucket: config.bucket, Key: locator }))
        .catch((error) => console.error(`Object storage delete failed for key ${locator}:`, error));
    },
  };
}

/** The backend new uploads are written with. */
export const storage: MediaStorage =
  env.media.backend === "OBJECT_STORAGE" ? s3Storage() : localStorage;

/*
 * Said out loud at startup, because "which storage is this instance actually using?" was the
 * question at the centre of D-042 and there was no way to answer it from the outside. A deploy log
 * that names the bucket is the difference between confirming a fix in seconds and discovering
 * weeks later that uploads went to a disk that no longer exists.
 */
console.info(
  env.media.backend === "OBJECT_STORAGE"
    ? `Media uploads will be written to OBJECT_STORAGE: bucket=${env.media.objectStorage.bucket} ` +
        `endpoint=${env.media.objectStorage.endpoint || "(AWS default)"}`
    : `Media uploads will be written to LOCAL storage at ${env.media.storageRoot} — correct for ` +
        "development, wrong for any deployment whose filesystem is ephemeral (D-042)",
);

/**
 * The backend a given row was written with. A row recorded as OBJECT_STORAGE cannot be read while
 * the process is configured for local storage only, so that case is reported rather than guessed
 * at — silently returning "no bytes" would look identical to the ephemeral-disk fault this whole
 * mechanism exists to fix.
 */
export function storageFor(rowBackend: StorageBackend): MediaStorage | null {
  if (rowBackend === "LOCAL") return localStorage;
  if (storage.backend === "OBJECT_STORAGE") return storage;
  console.error(
    "A media row is recorded as OBJECT_STORAGE but object storage is not configured " +
      "(set MEDIA_STORAGE_BACKEND and the S3 credentials).",
  );
  return null;
}
