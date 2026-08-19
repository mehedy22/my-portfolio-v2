import { Redis } from "ioredis";
import { env } from "../config/env.js";

export const redis = new Redis({
  host: env.redis.host,
  port: env.redis.port,
  maxRetriesPerRequest: 3,
  lazyConnect: false,
});

redis.on("error", (error: Error) => console.error("Redis error:", error.message));

/**
 * Fixed-window counter, shared by every throttled endpoint — login, contact, analytics and
 * password reset — so there is one throttling mechanism rather than one per feature.
 *
 * <p>The window starts at the first counted attempt and expires with it, so a caller who goes
 * quiet is not penalised indefinitely.
 */
export const rateLimiter = {
  async isWithinLimit(key: string, maxAttempts: number): Promise<boolean> {
    const current = await redis.get(key);
    return current === null || Number(current) < maxAttempts;
  },

  /** Counts one attempt, starting the window if this is the first. */
  async recordAttempt(key: string, windowSeconds: number): Promise<void> {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, windowSeconds);
  },

  /** Clears the counter — e.g. after a successful login. */
  async reset(key: string): Promise<void> {
    await redis.del(key);
  },
};
