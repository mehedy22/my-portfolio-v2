import { randomBytes, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { redis } from "../../common/redis.js";

/**
 * Access and refresh tokens (docs/08-security/authentication-authorization.md).
 *
 * <p>Both carry a `typ` claim so an access token cannot be replayed as a refresh token — without
 * it, the 15-minute credential the browser holds in memory would also open the 7-day door.
 */
const TYPE_ACCESS = "access";
const TYPE_REFRESH = "refresh";

export type RefreshToken = { token: string; jti: string };

export function createAccessToken(adminId: number): string {
  return jwt.sign({ typ: TYPE_ACCESS }, env.jwt.secret, {
    subject: String(adminId),
    expiresIn: env.jwt.accessTokenTtl,
  });
}

export function createRefreshToken(adminId: number): RefreshToken {
  const jti = randomUUID();
  const token = jwt.sign({ typ: TYPE_REFRESH }, env.jwt.secret, {
    subject: String(adminId),
    jwtid: jti,
    expiresIn: env.jwt.refreshTokenTtl,
  });
  return { token, jti };
}

/** The admin id, or null when the token is absent, invalid, expired or of the wrong type. */
export function resolveAccessTokenSubject(token: string | undefined): number | null {
  const claims = parse(token, TYPE_ACCESS);
  return claims ? Number(claims.sub) : null;
}

export function parseRefreshToken(
  token: string | undefined,
): { adminId: number; jti: string } | null {
  const claims = parse(token, TYPE_REFRESH);
  if (!claims?.jti) return null;
  return { adminId: Number(claims.sub), jti: claims.jti };
}

function parse(token: string | undefined, expectedType: string): jwt.JwtPayload | null {
  if (!token) return null;
  try {
    const claims = jwt.verify(token, env.jwt.secret) as jwt.JwtPayload;
    // Malformed, tampered, expired and wrong-type are all indistinguishable to the caller.
    return claims.typ === expectedType ? claims : null;
  } catch {
    return null;
  }
}

/**
 * The one refresh token that is currently valid per admin.
 *
 * <p>This is the small piece of server-side state D-016 accepted deliberately: without it,
 * "rotation" and "logout" could not invalidate anything and would only appear to work.
 */
const refreshKey = (adminId: number) => `auth:refresh:${adminId}`;

export const refreshTokenStore = {
  async store(adminId: number, jti: string): Promise<void> {
    await redis.set(refreshKey(adminId), jti, "EX", env.jwt.refreshTokenTtl);
  },
  async isCurrent(adminId: number, jti: string): Promise<boolean> {
    return (await redis.get(refreshKey(adminId))) === jti;
  },
  async revoke(adminId: number): Promise<void> {
    await redis.del(refreshKey(adminId));
  },
};

/**
 * Password-reset tokens: random, single-use, Redis-held with a TTL. `getdel` deletes as it reads,
 * so a link that has already been used — or that leaks from a mailbox afterwards — is worthless.
 */
const resetKey = (token: string) => `auth:reset:${token}`;

export const passwordResetTokenStore = {
  async issue(adminId: number): Promise<string> {
    const token = randomBytes(32).toString("base64url");
    await redis.set(resetKey(token), String(adminId), "EX", env.auth.passwordResetTtl);
    return token;
  },
  async consume(token: string): Promise<number | null> {
    if (!token?.trim()) return null;
    const adminId = await redis.getdel(resetKey(token));
    return adminId === null ? null : Number(adminId);
  },
};
