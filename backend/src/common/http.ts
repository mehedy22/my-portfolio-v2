import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError, type ZodType } from "zod";
import { ValidationError } from "./errors.js";

/** Wraps an async handler so a rejected promise reaches the error middleware. */
export function handler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

/**
 * Validates a request body, translating Zod issues into the same per-field `errors[]` array the
 * Java service produces for Bean Validation failures — the frontend already renders that shape.
 */
export function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  try {
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError(
        "Invalid request",
        error.issues.map((issue) => ({
          field: issue.path.join(".") || "body",
          message: issue.message,
        })),
      );
    }
    throw error;
  }
}

/**
 * The caller's address as the rate limiters should see it.
 *
 * <p>The app sits behind a reverse proxy, so `req.ip` alone would report the proxy and throttle
 * every visitor as one client. `X-Forwarded-For` is client-settable and therefore spoofable —
 * acceptable because the trust boundary is the proxy, which overwrites it, and because a forged
 * value only throttles the attacker under a different key.
 */
export function clientIp(req: Request): string {
  const forwarded = req.header("x-forwarded-for");
  if (forwarded && forwarded.trim()) return forwarded.split(",")[0]!.trim();
  return req.ip ?? "unknown";
}

/** Reads an optional string query parameter, treating blank as absent. */
export function queryString(req: Request, name: string): string | undefined {
  const value = req.query[name];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/**
 * Email validation matching Hibernate Validator's `@Email`, which the Java implementation used.
 *
 * <p>Zod's `.email()` requires a dotted TLD and therefore rejects `admin@localhost` — the address
 * the dev bootstrap creates, which would have locked the default account out of its own login.
 * Bean Validation is deliberately lenient here: an address is checked for shape, and whether it
 * can actually receive mail is a question only sending can answer.
 */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*$/;

/**
 * A path id, validated before it reaches a query.
 *
 * <p>`Number("abc")` is `NaN`, and a NaN bound into SQL is a database error the caller sees as a
 * 500 — for input the API should simply have rejected. This is the one place ids are parsed.
 */
export function idParam(req: Request, name = "id"): number {
  const raw = req.params[name];
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new ValidationError(`Parameter '${name}' must be a positive integer`);
  }
  return value;
}
