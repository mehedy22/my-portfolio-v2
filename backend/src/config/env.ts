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
