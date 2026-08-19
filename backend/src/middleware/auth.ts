import type { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "../common/errors.js";
import { resolveAccessTokenSubject } from "../modules/auth/tokens.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      adminId?: number;
    }
  }
}

/**
 * Populates `req.adminId` from a bearer token. Applied to `/api/v1/admin/**` only — everything
 * else is public, because visitors never authenticate (D-005).
 */
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
  const adminId = resolveAccessTokenSubject(token);

  if (adminId === null) {
    next(new UnauthorizedError("Authentication required"));
    return;
  }
  req.adminId = adminId;
  next();
}
