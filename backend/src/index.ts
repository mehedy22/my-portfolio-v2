import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { migrate } from "./db/migrate.js";
import { bootstrapAdmin } from "./modules/auth/auth.service.js";
import { pool } from "./db/pool.js";
import { redis } from "./common/redis.js";

/**
 * Startup order matters: the schema must exist before the admin bootstrap can read it, and both
 * must succeed before the server accepts a request — a half-migrated database serving traffic is
 * worse than a failed start.
 */
async function main(): Promise<void> {
  await migrate();
  await bootstrapAdmin();

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.info(`Portfolio API listening on http://localhost:${env.port}`);
    console.info(`OpenAPI contract at http://localhost:${env.port}/v3/api-docs`);
  });

  const shutdown = async (signal: string) => {
    console.info(`${signal} received, shutting down`);
    server.close();
    await Promise.allSettled([pool.end(), redis.quit()]);
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((error) => {
  console.error("Failed to start:", error);
  process.exit(1);
});
