import "dotenv/config";

/**
 * Configuration, read once and validated at startup.
 *
 * <p>Mirrors the Java service's `application.yml` exactly, including the parts that are
 * deliberately awkward: there is no working default for the JWT secret, so a deployment that
 * forgets it crashes loudly instead of signing admin tokens with a key committed to the
 * repository (D-017).
 */
function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  return raw === undefined ? fallback : Number.parseInt(raw, 10);
}

/** Accepts the same "15m" / "7d" / "1h" durations the Java config uses, in seconds. */
export function duration(value: string): number {
  const match = /^(\d+)\s*(ms|s|m|h|d)$/.exec(value.trim());
  if (!match) throw new Error(`Unparseable duration: ${value}`);
  const amount = Number(match[1]);
  const unit = match[2] as "ms" | "s" | "m" | "h" | "d";
  const seconds = { ms: 0.001, s: 1, m: 60, h: 3600, d: 86400 }[unit];
  return Math.round(amount * seconds);
}

/**
 * Validated at startup rather than at the first login: `SameSite=None` without `Secure` is
 * dropped by every current browser, which would look like a mysteriously broken session hours
 * later instead of a failed boot here.
 */
function sameSite(): "strict" | "lax" | "none" {
  const value = (process.env.COOKIE_SAMESITE ?? "strict").trim().toLowerCase();
  if (value !== "strict" && value !== "lax" && value !== "none") {
    throw new Error(`COOKIE_SAMESITE must be strict, lax or none — got "${value}"`);
  }
  if (value === "none" && (process.env.COOKIE_SECURE ?? "false") !== "true") {
    throw new Error("COOKIE_SAMESITE=none requires COOKIE_SECURE=true — browsers reject the cookie otherwise");
  }
  return value;
}

/**
 * Validated at startup, in the same spirit as {@link sameSite}: object storage that is selected
 * but not configured would fail at the first upload — or worse, serve 404s for every existing
 * image while looking healthy — which is exactly the failure mode D-042 exists to end.
 */
function mediaBackend(): "LOCAL" | "OBJECT_STORAGE" {
  const value = (process.env.MEDIA_STORAGE_BACKEND ?? "LOCAL").trim().toUpperCase();
  if (value !== "LOCAL" && value !== "OBJECT_STORAGE") {
    throw new Error(`MEDIA_STORAGE_BACKEND must be LOCAL or OBJECT_STORAGE — got "${value}"`);
  }
  if (value === "OBJECT_STORAGE") {
    const required = ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"];
    const missing = required.filter((name) => !(process.env[name] ?? "").trim());
    if (missing.length) {
      throw new Error(
        `MEDIA_STORAGE_BACKEND=OBJECT_STORAGE requires ${missing.join(", ")}. ` +
          "S3_ENDPOINT is also required for any provider other than AWS itself (R2, B2, MinIO).",
      );
    }
    /*
     * `.env.example` and the sample `.env` carry REPLACE-WITH-… placeholders so the whole set is
     * visible rather than hidden in comments. That makes "present" a weaker check than it looks:
     * six placeholder values satisfy it and then fail at the first upload, or serve 404s for every
     * image — the exact failure this validation exists to prevent (D-042).
     */
    const unfilled = [...required, "S3_ENDPOINT"].filter((name) =>
      (process.env[name] ?? "").includes("REPLACE-WITH"),
    );
    if (unfilled.length) {
      throw new Error(
        `MEDIA_STORAGE_BACKEND=OBJECT_STORAGE but ${unfilled.join(", ")} still holds the ` +
          "placeholder from .env.example. Put the real values in the deployment's environment " +
          "settings — they do not belong in a file in this repository.",
      );
    }
  }
  return value;
}

const isDev = (process.env.NODE_ENV ?? "development") !== "production";

export const env = {
  isDev,
  port: int("SERVER_PORT", 9100),

  db: {
    host: process.env.DB_HOST ?? "localhost",
    port: int("DB_PORT", 5433),
    database: process.env.DB_NAME ?? "portfolio",
    user: process.env.DB_USER ?? "portfolio",
    password: process.env.DB_PASSWORD ?? "portfolio",
  },

  redis: {
    host: process.env.REDIS_HOST ?? "localhost",
    port: int("REDIS_PORT", 6379),
  },

  cors: {
    allowedOrigins: (process.env.CORS_ALLOWED_ORIGINS ?? "http://localhost:3000,http://localhost:3001")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  },

  jwt: {
    // No fallback in production, deliberately (D-017). The dev fallback is public by definition,
    // which is exactly why it may never be reachable outside development.
    secret: isDev
      ? process.env.JWT_SECRET ?? "dev-only-insecure-secret-at-least-32-bytes-long!!"
      : required("JWT_SECRET"),
    accessTokenTtl: duration(process.env.JWT_ACCESS_TOKEN_TTL ?? "15m"),
    refreshTokenTtl: duration(process.env.JWT_REFRESH_TOKEN_TTL ?? "7d"),
  },

  auth: {
    loginRateLimit: {
      maxAttempts: int("LOGIN_RATE_LIMIT_MAX_ATTEMPTS", 5),
      window: duration(process.env.LOGIN_RATE_LIMIT_WINDOW ?? "15m"),
    },
    cookieSecure: (process.env.COOKIE_SECURE ?? "false") === "true",
    /*
     * `strict` while the frontend and the API share an origin (local development). A frontend
     * deployed to its own domain — Vercel, say — makes every API call cross-site, and a
     * SameSite=Strict cookie is simply not sent on those, so the refresh token would never
     * arrive and every session would die at the 15-minute access-token expiry. `none` is the
     * only value browsers send cross-site, and they reject it without `Secure`.
     */
    cookieSameSite: sameSite(),
    bootstrap: {
      email: process.env.ADMIN_EMAIL ?? (isDev ? "admin@localhost" : ""),
      password: process.env.ADMIN_PASSWORD ?? (isDev ? "dev-only-password" : ""),
    },
    passwordResetTtl: duration(process.env.PASSWORD_RESET_TTL ?? "30m"),
  },

  media: {
    maxImageBytes: int("MEDIA_MAX_IMAGE_MB", 5) * 1024 * 1024,
    maxDocumentBytes: int("MEDIA_MAX_DOCUMENT_MB", 10) * 1024 * 1024,
    // Outer guard, above the largest per-type limit, so a huge body is refused before buffering.
    maxUploadBytes: int("UPLOAD_MAX_FILE_MB", 12) * 1024 * 1024,
    storageRoot: process.env.MEDIA_STORAGE_ROOT ?? "./data/media",
    /*
     * Where new uploads go. LOCAL stays the default for development, where a directory is simpler
     * than a bucket. Any deployment on an ephemeral filesystem needs OBJECT_STORAGE — see D-042:
     * with LOCAL, every deploy discarded every upload while the rows kept pointing at them.
     */
    backend: mediaBackend(),
    objectStorage: {
      bucket: process.env.S3_BUCKET ?? "",
      // Empty for AWS itself; set for every S3-compatible provider (R2, B2, MinIO).
      endpoint: process.env.S3_ENDPOINT ?? "",
      // R2 wants "auto"; AWS and B2 want a real region.
      region: process.env.S3_REGION ?? "auto",
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
      // Path style suits a custom endpoint; AWS prefers virtual-hosted, which is the default there.
      forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? (process.env.S3_ENDPOINT ? "true" : "false")) === "true",
    },
  },

  contact: {
    rateLimit: {
      maxAttempts: int("CONTACT_RATE_LIMIT_MAX_ATTEMPTS", 5),
      window: duration(process.env.CONTACT_RATE_LIMIT_WINDOW ?? "1h"),
    },
  },

  analytics: {
    rateLimit: {
      maxAttempts: int("ANALYTICS_RATE_LIMIT_MAX_ATTEMPTS", 60),
      window: duration(process.env.ANALYTICS_RATE_LIMIT_WINDOW ?? "1m"),
    },
  },
} as const;

if (env.jwt.secret.length < 32) {
  throw new Error(
    "JWT signing secret is too short for HS256: need at least 32 bytes.\n" +
      'Generate one with: export JWT_SECRET="$(openssl rand -base64 48)"',
  );
}
