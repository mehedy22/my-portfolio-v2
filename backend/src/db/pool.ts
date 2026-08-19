import pg from "pg";
import { env } from "../config/env.js";

/**
 * One shared connection pool.
 *
 * <p>`BIGINT` arrives from `pg` as a string by default, because a 64-bit integer does not fit a
 * JS number. Every id in this schema is a BIGINT and every one of them is far below 2^53, so they
 * are parsed to numbers here — otherwise every id would serialize as `"3"` instead of `3` and
 * quietly break the contract the frontend's generated client is built against.
 */
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => Number.parseInt(value, 10));

/**
 * `DATE` stays a plain `YYYY-MM-DD` string.
 *
 * <p>By default `pg` turns a DATE into a JS `Date` at *local* midnight. Serializing that with
 * `toISOString()` then shifts it backwards by the UTC offset, so on a UTC+6 machine every
 * publication date, start date and issue date came back one day early. A DATE has no time and no
 * zone; the honest representation is the string the database already holds.
 */
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);

export const pool = new pg.Pool({
  host: env.db.host,
  port: env.db.port,
  database: env.db.database,
  user: env.db.user,
  password: env.db.password,
  max: 10,
});

export type Sql = pg.Pool | pg.PoolClient;

/** Runs `work` inside a transaction, rolling back on any throw. */
export async function transaction<T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
