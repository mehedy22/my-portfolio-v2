import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./pool.js";

/**
 * Applies the same versioned SQL files the Java service uses — byte-for-byte the same schema,
 * constraints and indexes, so the two implementations cannot drift apart on data shape.
 *
 * <p>Deliberately minimal: a `schema_version` table, filenames as versions, applied in order,
 * never re-applied, each inside its own transaction. It records a checksum and refuses to start
 * if an already-applied file has been edited — the same protection Flyway gives, and the reason
 * the project's own rule is "a correction is always a new migration".
 */
const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "migrations");

function versionOf(filename: string): number {
  const match = /^V(\d+)__/.exec(filename);
  if (!match) throw new Error(`Migration filename does not start with V<n>__ : ${filename}`);
  return Number(match[1]);
}

async function checksum(sql: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sql));
  return Buffer.from(digest).toString("hex").slice(0, 32);
}

export async function migrate(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version     INT PRIMARY KEY,
      filename    TEXT        NOT NULL,
      checksum    TEXT        NOT NULL,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((name) => name.endsWith(".sql"))
    .sort((a, b) => versionOf(a) - versionOf(b));

  const { rows } = await pool.query<{ version: number; filename: string; checksum: string }>(
    "SELECT version, filename, checksum FROM schema_version",
  );
  const applied = new Map(rows.map((row) => [row.version, row]));

  for (const file of files) {
    const version = versionOf(file);
    const sql = await readFile(join(MIGRATIONS_DIR, file), "utf8");
    const sum = await checksum(sql);
    const previous = applied.get(version);

    if (previous) {
      if (previous.checksum !== sum) {
        throw new Error(
          `Migration V${version} (${file}) has changed since it was applied. ` +
            "Applied migrations are immutable — add a new migration instead.",
        );
      }
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        "INSERT INTO schema_version (version, filename, checksum) VALUES ($1, $2, $3)",
        [version, file, sum],
      );
      await client.query("COMMIT");
      console.log(`Applied migration V${version} — ${file}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw new Error(`Migration V${version} (${file}) failed: ${(error as Error).message}`);
    } finally {
      client.release();
    }
  }

  const current = files.length ? versionOf(files[files.length - 1]!) : 0;
  console.log(`Schema is at version v${current} (${files.length} migrations)`);
}

// Allow `npm run migrate` as well as being called from the app's startup.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop() ?? "")) {
  migrate()
    .then(() => pool.end())
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
