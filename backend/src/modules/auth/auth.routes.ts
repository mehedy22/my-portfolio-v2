import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env.js";
import { ok } from "../../common/api.js";
import { clientIp, EMAIL_PATTERN, handler, parseBody } from "../../common/http.js";
import * as auth from "./auth.service.js";

export const authRouter = Router();

const REFRESH_COOKIE = "refreshToken";
/** Scoped to the auth endpoints: the cookie is never sent to anything that does not need it. */
const COOKIE_PATH = "/api/v1/auth";

const loginSchema = z.object({
  email: z.string().min(1, "must not be blank").regex(EMAIL_PATTERN, "must be a well-formed email address"),
  password: z.string().min(1, "must not be blank"),
});

const resetRequestSchema = z.object({
  email: z.string().min(1, "must not be blank").regex(EMAIL_PATTERN, "must be a well-formed email address").max(255),
});

const resetConfirmSchema = z.object({
  token: z.string().min(1, "must not be blank"),
  newPassword: z.string().min(12, "Password must be at least 12 characters").max(200),
});

/**
 * httpOnly/Secure/SameSite=Strict, never in a response body (D-016): a body-carried refresh token
 * must be held by JavaScript, so one XSS payload exfiltrates a 7-day credential.
 */
function refreshCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: env.auth.cookieSecure,
    sameSite: "strict" as const,
    path: COOKIE_PATH,
    maxAge: maxAgeSeconds * 1000,
  };
}

authRouter.post(
  "/auth/login",
  handler(async (req, res) => {
    const { email, password } = parseBody(loginSchema, req.body);
    const tokens = await auth.login(email, password, clientIp(req));
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, refreshCookieOptions(env.jwt.refreshTokenTtl));
    return ok(res, {
      accessToken: tokens.accessToken,
      tokenType: "Bearer",
      expiresInSeconds: tokens.accessTokenTtlSeconds,
    });
  }),
);

authRouter.post(
  "/auth/refresh",
  handler(async (req, res) => {
    const tokens = await auth.refresh(req.cookies?.[REFRESH_COOKIE]);
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, refreshCookieOptions(env.jwt.refreshTokenTtl));
    return ok(res, {
      accessToken: tokens.accessToken,
      tokenType: "Bearer",
      expiresInSeconds: tokens.accessTokenTtlSeconds,
    });
  }),
);

authRouter.post(
  "/auth/logout",
  handler(async (req, res) => {
    await auth.logout(req.cookies?.[REFRESH_COOKIE]);
    res.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
    return ok(res, null, "Logged out");
  }),
);

authRouter.post(
  "/auth/password-reset/request",
  handler(async (req, res) => {
    const { email } = parseBody(resetRequestSchema, req.body);
    await auth.requestPasswordReset(email, clientIp(req));
    // Deliberately the same answer whether or not the address is known.
    return ok(res, null, "If that address is registered, a reset link has been sent.");
  }),
);

authRouter.post(
  "/auth/password-reset/confirm",
  handler(async (req, res) => {
    const { token, newPassword } = parseBody(resetConfirmSchema, req.body);
    await auth.confirmPasswordReset(token, newPassword);
    // Clear the cookie too: the server has revoked it, and a dead cookie only produces a
    // confusing 401 on the next silent refresh.
    res.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
    return ok(res, null, "Password updated. Please sign in again.");
  }),
);

export const adminAuthRouter = Router();

adminAuthRouter.get(
  "/admin/me",
  handler(async (req, res) => ok(res, await auth.currentAdmin(req.adminId!))),
);
