import bcrypt from "bcryptjs";
import { env } from "../../config/env.js";
import { pool } from "../../db/pool.js";
import { RateLimitError, UnauthorizedError } from "../../common/errors.js";
import { rateLimiter } from "../../common/redis.js";
import { notifier } from "../notification/notifier.js";
import {
  createAccessToken,
  createRefreshToken,
  parseRefreshToken,
  passwordResetTokenStore,
  refreshTokenStore,
} from "./tokens.js";

/** Identical for every credential failure — no account enumeration. */
const INVALID_CREDENTIALS = "Invalid email or password";
const LOGIN_KEY = "auth:login:attempts:";
const RESET_KEY = "auth:reset:attempts:";
/** Matches the Java service's BCrypt strength. */
const BCRYPT_ROUNDS = 12;

export type AuthTokens = { accessToken: string; accessTokenTtlSeconds: number; refreshToken: string };
type AdminRow = { id: number; email: string; password_hash: string; last_login_at: Date | null };

export async function login(email: string, password: string, ip: string): Promise<AuthTokens> {
  const key = LOGIN_KEY + ip;

  // Checked before any DB work, so a throttled request never touches Postgres.
  if (!(await rateLimiter.isWithinLimit(key, env.auth.loginRateLimit.maxAttempts))) {
    console.warn(`Login rate limit exceeded for ip=${ip}`);
    throw new RateLimitError("Too many login attempts. Try again later.");
  }

  const { rows } = await pool.query<AdminRow>("SELECT * FROM admin WHERE email = $1", [email]);
  const admin = rows[0];

  // The compare runs even when the row is missing, against a dummy hash, so the response time
  // does not quietly tell an attacker which addresses exist.
  const hash = admin?.password_hash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv";
  const matches = await bcrypt.compare(password, hash);

  if (!admin || !matches) {
    await rateLimiter.recordAttempt(key, env.auth.loginRateLimit.window);
    console.warn(`Failed login attempt for email=${email} from ip=${ip}`);
    throw new UnauthorizedError(INVALID_CREDENTIALS);
  }

  await rateLimiter.reset(key);
  await pool.query("UPDATE admin SET last_login_at = now(), updated_at = now() WHERE id = $1", [admin.id]);
  console.info(`Successful login for adminId=${admin.id} from ip=${ip}`);
  return issueTokens(admin.id);
}

export async function refresh(refreshToken: string | undefined): Promise<AuthTokens> {
  const parsed = parseRefreshToken(refreshToken);
  if (!parsed) throw new UnauthorizedError("Invalid refresh token");

  // The presented token must be the current one: anything else has been rotated away, revoked by
  // logout, or replayed.
  if (!(await refreshTokenStore.isCurrent(parsed.adminId, parsed.jti))) {
    throw new UnauthorizedError("Invalid refresh token");
  }
  return issueTokens(parsed.adminId);
}

export async function logout(refreshToken: string | undefined): Promise<void> {
  const parsed = parseRefreshToken(refreshToken);
  if (parsed) await refreshTokenStore.revoke(parsed.adminId);
}

export async function currentAdmin(adminId: number) {
  const { rows } = await pool.query<AdminRow>(
    "SELECT id, email, last_login_at FROM admin WHERE id = $1",
    [adminId],
  );
  const admin = rows[0];
  if (!admin) throw new UnauthorizedError("Authentication required");
  return { id: admin.id, email: admin.email, lastLoginAt: admin.last_login_at?.toISOString() ?? null };
}

/**
 * Starts a reset. Returns nothing and never signals whether the address is known: the caller is
 * anonymous, and this endpoint must not become a way to discover the admin's email.
 */
export async function requestPasswordReset(email: string, ip: string): Promise<void> {
  const key = RESET_KEY + ip;
  if (!(await rateLimiter.isWithinLimit(key, env.auth.loginRateLimit.maxAttempts))) {
    console.warn(`Password-reset rate limit exceeded for ip=${ip}`);
    throw new RateLimitError("Too many reset requests. Try again later.");
  }
  await rateLimiter.recordAttempt(key, env.auth.loginRateLimit.window);

  const { rows } = await pool.query<AdminRow>("SELECT id, email FROM admin WHERE email = $1", [email]);
  const admin = rows[0];
  if (!admin) {
    console.info(`Password reset requested for an unknown address from ip=${ip}`);
    return;
  }
  const token = await passwordResetTokenStore.issue(admin.id);
  await notifier.passwordReset(admin.email, token);
  console.info(`Password reset requested for adminId=${admin.id}`);
}

export async function confirmPasswordReset(token: string, newPassword: string): Promise<void> {
  const adminId = await passwordResetTokenStore.consume(token);
  if (adminId === null) throw new UnauthorizedError("This reset link is invalid or has expired");

  const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  const { rowCount } = await pool.query(
    "UPDATE admin SET password_hash = $1, updated_at = now() WHERE id = $2",
    [hash, adminId],
  );
  if (!rowCount) throw new UnauthorizedError("This reset link is invalid or has expired");

  // Whoever prompted the reset may have had a live session; revoking means changing the password
  // actually ends it rather than only changing what logs in next time.
  await refreshTokenStore.revoke(adminId);
  console.info(`Password reset completed for adminId=${adminId}`);
}

async function issueTokens(adminId: number): Promise<AuthTokens> {
  const refreshToken = createRefreshToken(adminId);
  await refreshTokenStore.store(adminId, refreshToken.jti);
  return {
    accessToken: createAccessToken(adminId),
    accessTokenTtlSeconds: env.jwt.accessTokenTtl,
    refreshToken: refreshToken.token,
  };
}

/**
 * Provisions the single admin at startup when none exists (D-005). Never overwrites, never logs
 * the password, and warns with instructions when the variables are unset.
 */
export async function bootstrapAdmin(): Promise<void> {
  const { email, password } = env.auth.bootstrap;
  const { rows } = await pool.query<{ count: string }>("SELECT count(*) FROM admin");
  if (Number(rows[0]!.count) > 0) return;

  if (!email || !password) {
    console.warn(
      "No admin account exists and ADMIN_EMAIL/ADMIN_PASSWORD are unset. " +
        "Set both and restart to provision the single admin account.",
    );
    return;
  }
  await pool.query("INSERT INTO admin (email, password_hash) VALUES ($1, $2)", [
    email,
    await bcrypt.hash(password, BCRYPT_ROUNDS),
  ]);
  console.info(`Bootstrapped the admin account for email=${email}`);
}
