import createClient, { type Middleware } from "openapi-fetch";
import type { paths } from "@/generated/api/schema";

/** Shared with the public half of the app — one app, one API origin. */
export const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:9200";

/**
 * The access token lives in memory only — never localStorage, never a readable cookie
 * (docs/08-security/authentication-authorization.md). A module-level variable is exactly that:
 * it dies with the tab, and no XSS payload can read it out of storage that does not exist.
 */
let accessToken: string | null = null;
let onAuthLost: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export function setAuthLostHandler(handler: (() => void) | null) {
  onAuthLost = handler;
}

/** Rotates the refresh cookie for a new access token. The browser sends the httpOnly cookie. */
export async function refreshAccessToken(): Promise<string | null> {
  const response = await fetch(`${apiBaseUrl}/api/v1/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) return null;
  const body = await response.json();
  const token = body?.data?.accessToken ?? null;
  accessToken = token;
  return token;
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${apiBaseUrl}/api/v1/auth/logout`, { method: "POST", credentials: "include" });
  } finally {
    accessToken = null;
  }
}

/**
 * The auth interceptor Phase 11 specifies, as one middleware pair:
 *
 * <ul>
 *   <li>attach the in-memory bearer token to every request;
 *   <li>on a 401, silently refresh once and retry the original request; if that fails, drop auth
 *       state and let the app redirect to /login.
 * </ul>
 *
 * <p>The retry is deliberately once-only — a refresh that succeeds but still yields a 401 means
 * the request is genuinely unauthorised, and retrying again would loop.
 */
const authMiddleware: Middleware = {
  async onRequest({ request }) {
    if (accessToken) request.headers.set("Authorization", `Bearer ${accessToken}`);
    return request;
  },
  async onResponse({ request, response }) {
    if (response.status !== 401 || request.url.includes("/api/v1/auth/")) return response;

    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      accessToken = null;
      onAuthLost?.();
      return response;
    }

    const retry = request.clone();
    retry.headers.set("Authorization", `Bearer ${refreshed}`);
    return fetch(retry);
  },
};

export const api = createClient<paths>({ baseUrl: apiBaseUrl, credentials: "include" });
api.use(authMiddleware);

/** Media paths come back root-relative; the admin previews them from the API origin. */
export function mediaUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  return url.startsWith("http") ? url : `${apiBaseUrl}${url}`;
}

/** The Phase 7 error envelope, as much of it as the frontend is allowed to show. */
export type ApiErrorEnvelope = {
  message?: string;
  errors?: { field: string; message: string }[];
};

/**
 * Turns a failed call into a message safe to display. Field-level Bean Validation errors are
 * preferred because they say *which* input is wrong; otherwise the envelope's `message`. Nothing
 * else is ever surfaced — NFR-05's discipline applies on this side too.
 */
export function apiError(error: unknown, fallback = "Something went wrong."): string {
  const envelope = error as ApiErrorEnvelope | undefined;
  const fieldErrors = envelope?.errors?.map((item) => `${item.field}: ${item.message}`).join(", ");
  return fieldErrors || envelope?.message?.trim() || fallback;
}
