import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env.js";
import { pool } from "../../db/pool.js";
import { NotFoundError, RateLimitError } from "../../common/errors.js";
import { rateLimiter } from "../../common/redis.js";
import { created, noContent, ok, page, pageParams } from "../../common/api.js";
import { clientIp, EMAIL_PATTERN, handler, parseBody, queryString, idParam } from "../../common/http.js";
import { notifier } from "../notification/notifier.js";

const STATUSES = ["NEW", "READ", "REPLIED"] as const;
const RATE_LIMIT_KEY = "contact:submit:";

const submitSchema = z.object({
  name: z.string().trim().min(1, "must not be blank").max(200),
  email: z.string().trim().min(1, "must not be blank").regex(EMAIL_PATTERN, "must be a well-formed email address").max(255),
  subject: z.string().max(300).nullish(),
  message: z.string().trim().min(1, "must not be blank").max(5000),
  /**
   * The honeypot (D-023). Hidden from humans by CSS, named plausibly on purpose: a field called
   * "honeypot" tells a bot exactly what to skip.
   */
  website: z.string().nullish(),
});

const statusSchema = z.object({ status: z.enum(STATUSES) });

export const contactPublicRouter = Router();
export const contactAdminRouter = Router();

contactPublicRouter.post(
  "/contact",
  handler(async (req, res) => {
    const body = parseBody(submitSchema, req.body);
    const ip = clientIp(req);
    const key = RATE_LIMIT_KEY + ip;

    // Rate limit first and outside any transaction, so a flood never reaches Postgres.
    if (!(await rateLimiter.isWithinLimit(key, env.contact.rateLimit.maxAttempts))) {
      console.warn("Contact submission rate limit exceeded");
      throw new RateLimitError("Too many messages sent. Please try again later.");
    }
    // Honeypot hits consume an attempt too, so a bot cannot retry past the limiter for free.
    await rateLimiter.recordAttempt(key, env.contact.rateLimit.window);

    if (body.website?.trim()) {
      // Silently accepted: the caller gets the same 201 a human gets, so a bot cannot distinguish
      // "delivered" from "dropped" and tune its way past the trap.
      console.info("Contact submission discarded: honeypot field was filled");
      return created(res, null, "Message received");
    }

    const subject = body.subject?.trim() ? body.subject.trim() : null;
    const { rows } = await pool.query<{ id: number }>(
      "INSERT INTO contact_message (name, email, subject, message) VALUES ($1, $2, $3, $4) RETURNING id",
      [body.name.trim(), body.email.trim(), subject, body.message],
    );
    console.info(`Contact message received: id=${rows[0]!.id} status=NEW`);

    // Fire-and-forget: the message is already stored, and a notification problem must never turn
    // the visitor's success into an error they cannot act on.
    void notifyAdmin(body.name.trim(), body.email.trim(), subject);

    return created(res, null, "Message received");
  }),
);

contactAdminRouter.get(
  "/admin/contact-messages",
  handler(async (req, res) => {
    const { page: pageNumber, size, offset } = pageParams(req.query, 20, 100);
    const status = queryString(req, "status");
    const where = status ? "WHERE deleted_at IS NULL AND status = $1" : "WHERE deleted_at IS NULL";
    const params = status ? [status] : [];

    const { rows } = await pool.query(
      `SELECT * FROM contact_message ${where} ORDER BY created_at DESC, id DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, size, offset],
    );
    const { rows: counted } = await pool.query<{ count: string }>(
      `SELECT count(*) FROM contact_message ${where}`,
      params,
    );
    return ok(res, page(rows.map(toResponse), pageNumber, size, Number(counted[0]!.count)));
  }),
);

contactAdminRouter.patch(
  "/admin/contact-messages/:id/status",
  handler(async (req, res) => {
    const { status } = parseBody(statusSchema, req.body);
    // Any transition, in both directions: "mark this back as unread" is an ordinary inbox action,
    // and no design phase asked for a one-way state machine (D-023).
    const { rows } = await pool.query(
      "UPDATE contact_message SET status = $1, updated_at = now() WHERE id = $2 AND deleted_at IS NULL RETURNING *",
      [status, idParam(req)],
    );
    if (!rows.length) throw new NotFoundError(`Contact message ${idParam(req)} not found`);
    return ok(res, toResponse(rows[0]!), "Status updated");
  }),
);

contactAdminRouter.delete(
  "/admin/contact-messages/:id",
  handler(async (req, res) => {
    const { rowCount } = await pool.query(
      "UPDATE contact_message SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL",
      [idParam(req)],
    );
    if (!rowCount) throw new NotFoundError(`Contact message ${idParam(req)} not found`);
    return noContent(res);
  }),
);

/** Destination is the deliberately-private `contact.notification_email` setting (D-024). */
async function notifyAdmin(name: string, email: string, subject: string | null): Promise<void> {
  try {
    const { rows } = await pool.query<{ value: string | null }>(
      "SELECT value FROM site_setting WHERE key = 'contact.notification_email'",
    );
    const destination = rows[0]?.value?.trim();
    if (!destination) return;
    await notifier.newContactMessage(name, email, subject);
  } catch (error) {
    console.error("Could not notify about contact message", error);
  }
}

function toResponse(row: Record<string, any>) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    subject: row.subject,
    message: row.message,
    status: row.status,
    createdAt: row.created_at?.toISOString() ?? null,
    updatedAt: row.updated_at?.toISOString() ?? null,
  };
}
