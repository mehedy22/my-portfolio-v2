/**
 * Reports media rows whose bytes cannot be read, and optionally clears them.
 *
 * <p>Written for the 2026-08-20 incident (D-042): the deployment's filesystem was ephemeral, so
 * every uploaded file vanished on the next deploy while its row survived. The site then served
 * broken images to every visitor whose browser had not cached them — and, because the bytes had
 * been sent with a one-year immutable cache, the person who uploaded them was the last to notice.
 *
 * <p>`npm run media:doctor` lists the damage. `npm run media:doctor -- --purge` soft-deletes the
 * unreadable rows, which is what turns broken images into clean empty states: content referring
 * to them drops the reference (D-019), so pages render as though nothing was ever attached.
 */
import { pool } from "./pool.js";
import { storageFor } from "../modules/media/storage.js";

async function main() {
  const purge = process.argv.includes("--purge");
  const { rows } = await pool.query<{
    id: number;
    original_file_name: string;
    storage_backend: "LOCAL" | "OBJECT_STORAGE";
    storage_path_or_url: string;
  }>(
    `SELECT id, original_file_name, storage_backend, storage_path_or_url
     FROM media WHERE deleted_at IS NULL ORDER BY id`,
  );

  const broken: number[] = [];
  for (const row of rows) {
    const stream = await storageFor(row.storage_backend)?.open(row.storage_path_or_url);
    if (stream) {
      stream.destroy();
      continue;
    }
    broken.push(row.id);
    console.log(
      `  MISSING  id=${row.id}  ${row.original_file_name}  ` +
        `[${row.storage_backend}] ${row.storage_path_or_url}`,
    );
  }

  console.log(`\n${rows.length - broken.length}/${rows.length} media rows have readable bytes.`);
  if (!broken.length) {
    await pool.end();
    return;
  }

  if (!purge) {
    console.log("Re-upload those files, or run with --purge to soft-delete the rows.");
    await pool.end();
    return;
  }

  const { rowCount } = await pool.query(
    "UPDATE media SET deleted_at = now() WHERE id = ANY($1::bigint[]) AND deleted_at IS NULL",
    [broken],
  );
  console.log(`Soft-deleted ${rowCount} row(s). References to them now drop out of responses.`);
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
