import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env.js";
import { pool } from "../../db/pool.js";
import { RateLimitError } from "../../common/errors.js";
import { rateLimiter } from "../../common/redis.js";
import { created, ok, page, pageParams } from "../../common/api.js";
import { clientIp, handler, parseBody, queryString } from "../../common/http.js";

const RATE_LIMIT_KEY = "analytics:view:";
const TOP_N = 10;
const TREND_DAYS = 30;

const viewSchema = z.object({
  path: z.string().trim().min(1, "must not be blank").max(500),
  entityType: z.string().max(30).nullish(),
  entityId: z.number().nullish(),
  referrer: z.string().max(500).nullish(),
});

export const analyticsPublicRouter = Router();
export const analyticsAdminRouter = Router();

/**
 * Reduces a User-Agent to two coarse buckets and throws the rest away.
 *
 * <p>Intentionally crude. A full UA-parsing library would give exact versions and OS builds —
 * precisely the detail that makes a User-Agent a fingerprint. "MOBILE" and "Safari" answer what
 * the admin actually wants to know while retaining nothing that could re-identify a visitor.
 */
function deviceType(userAgent: string | undefined): "DESKTOP" | "MOBILE" | "TABLET" | "UNKNOWN" {
  if (!userAgent?.trim()) return "UNKNOWN";
  const value = userAgent.toLowerCase();
  if (value.includes("ipad") || (value.includes("android") && !value.includes("mobile")) || value.includes("tablet")) {
    return "TABLET";
  }
  if (value.includes("mobi") || value.includes("iphone") || value.includes("android")) return "MOBILE";
  return "DESKTOP";
}

/** Family only — never a version, which narrows a visitor far more than the family does. */
function browserFamily(userAgent: string | undefined): string | null {
  if (!userAgent?.trim()) return null;
  const value = userAgent.toLowerCase();
  // Order matters: Edge and Chrome both claim "chrome"/"safari" in their UA strings.
  if (value.includes("edg/")) return "Edge";
  if (value.includes("opr/") || value.includes("opera")) return "Opera";
  if (value.includes("firefox")) return "Firefox";
  if (value.includes("chrome") || value.includes("crios")) return "Chrome";
  if (value.includes("safari")) return "Safari";
  return "Other";
}

analyticsPublicRouter.post(
  "/analytics/page-view",
  handler(async (req, res) => {
    const body = parseBody(viewSchema, req.body);
    const key = RATE_LIMIT_KEY + clientIp(req);

    if (!(await rateLimiter.isWithinLimit(key, env.analytics.rateLimit.maxAttempts))) {
      // Silently dropping would corrupt the counts invisibly; a 429 is honest and the browser
      // tracker treats it as a no-op.
      throw new RateLimitError("Too many page views recorded. Please slow down.");
    }
    await rateLimiter.recordAttempt(key, env.analytics.rateLimit.window);

    const userAgent = req.header("user-agent");
    await pool.query(
      `INSERT INTO page_view (path, entity_type, entity_id, referrer, device_type, browser)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        body.path,
        body.entityType?.trim() || null,
        body.entityId ?? null,
        body.referrer?.trim() || null,
        // Derived server-side; values sent by the client are ignored, so the breakdown
        // cannot be forged.
        deviceType(userAgent),
        browserFamily(userAgent),
      ],
    );
    return created(res, null, "Recorded");
  }),
);

analyticsAdminRouter.get(
  "/admin/analytics/summary",
  handler(async (_req, res) => {
    const since = `now() - interval '${TREND_DAYS} days'`;
    const [total, today, week, month, daily, topPages, topReferrers, topEntities, byDevice, byBrowser] =
      await Promise.all([
        pool.query<{ count: string }>("SELECT count(*) FROM page_view"),
        pool.query<{ count: string }>("SELECT count(*) FROM page_view WHERE viewed_at >= date_trunc('day', now())"),
        pool.query<{ count: string }>("SELECT count(*) FROM page_view WHERE viewed_at >= now() - interval '7 days'"),
        pool.query<{ count: string }>(`SELECT count(*) FROM page_view WHERE viewed_at >= ${since}`),
        pool.query<{ day: Date; total: string }>(
          `SELECT date_trunc('day', viewed_at) AS day, count(*) AS total FROM page_view
           WHERE viewed_at >= ${since} GROUP BY 1 ORDER BY 1`,
        ),
        pool.query(`SELECT path AS label, count(*) AS total FROM page_view WHERE viewed_at >= ${since}
                    GROUP BY path ORDER BY count(*) DESC LIMIT ${TOP_N}`),
        pool.query(`SELECT referrer AS label, count(*) AS total FROM page_view
                    WHERE viewed_at >= ${since} AND referrer IS NOT NULL AND referrer <> ''
                    GROUP BY referrer ORDER BY count(*) DESC LIMIT ${TOP_N}`),
        pool.query(`SELECT entity_type, entity_id, count(*) AS total FROM page_view
                    WHERE viewed_at >= ${since} AND entity_type IS NOT NULL AND entity_id IS NOT NULL
                    GROUP BY entity_type, entity_id ORDER BY count(*) DESC LIMIT ${TOP_N}`),
        pool.query(`SELECT device_type AS label, count(*) AS total FROM page_view
                    WHERE viewed_at >= ${since} GROUP BY device_type ORDER BY count(*) DESC`),
        pool.query(`SELECT browser AS label, count(*) AS total FROM page_view
                    WHERE viewed_at >= ${since} AND browser IS NOT NULL
                    GROUP BY browser ORDER BY count(*) DESC`),
      ]);

    // Zero-filled, so the chart shows a gap rather than skipping a date.
    const counts = new Map(daily.rows.map((row) => [row.day.toISOString().slice(0, 10), Number(row.total)]));
    const dailyViews = Array.from({ length: TREND_DAYS + 1 }, (_, index) => {
      const date = new Date(Date.now() - (TREND_DAYS - index) * 86400000).toISOString().slice(0, 10);
      return { date, views: counts.get(date) ?? 0 };
    });

    const labels = (rows: any[]) => rows.map((row) => ({ label: row.label, views: Number(row.total) }));

    /*
     * There is deliberately no "unique visitors" or "average session" (D-026): both require
     * recognising a visitor across requests, and this module stores nothing that can.
     */
    return ok(res, {
      totalViews: Number(total.rows[0]!.count),
      viewsToday: Number(today.rows[0]!.count),
      viewsLast7Days: Number(week.rows[0]!.count),
      viewsLast30Days: Number(month.rows[0]!.count),
      dailyViews,
      topPages: labels(topPages.rows),
      topReferrers: labels(topReferrers.rows),
      topEntities: topEntities.rows.map((row: any) => ({
        entityType: row.entity_type,
        entityId: row.entity_id,
        views: Number(row.total),
      })),
      byDevice: labels(byDevice.rows),
      byBrowser: labels(byBrowser.rows),
    });
  }),
);

analyticsAdminRouter.get(
  "/admin/analytics/page-views",
  handler(async (req, res) => {
    const { page: pageNumber, size, offset } = pageParams(req.query, 50, 200);
    const entityType = queryString(req, "entityType");
    const from = queryString(req, "from");
    const to = queryString(req, "to");

    const conditions: string[] = [];
    const params: unknown[] = [];
    if (entityType) {
      params.push(entityType);
      conditions.push(`entity_type = $${params.length}`);
    }
    if (from) {
      params.push(from);
      conditions.push(`viewed_at >= $${params.length}::date`);
    }
    if (to) {
      params.push(to);
      // Inclusive of the whole day the admin picked, which is what a date filter is expected
      // to mean.
      conditions.push(`viewed_at < ($${params.length}::date + interval '1 day')`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `SELECT * FROM page_view ${where} ORDER BY viewed_at DESC, id DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, size, offset],
    );
    const { rows: counted } = await pool.query<{ count: string }>(
      `SELECT count(*) FROM page_view ${where}`,
      params,
    );

    return ok(
      res,
      page(
        rows.map((row: any) => ({
          id: row.id,
          path: row.path,
          entityType: row.entity_type,
          entityId: row.entity_id,
          referrer: row.referrer,
          deviceType: row.device_type,
          browser: row.browser,
          viewedAt: row.viewed_at.toISOString(),
        })),
        pageNumber,
        size,
        Number(counted[0]!.count),
      ),
    );
  }),
);
