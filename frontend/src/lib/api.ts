import createClient from "openapi-fetch";
import type { paths } from "@/generated/api/schema";

/**
 * Where the API lives.
 *
 * <p>Server Components fetch over the internal network (`API_BASE_URL`); anything the browser
 * requests — the contact form, media URLs — must use the externally reachable host
 * (`NEXT_PUBLIC_API_BASE_URL`). Keeping both means a containerised deploy can talk to `api:9000`
 * internally while the browser still resolves a public hostname.
 */
export const serverApiBaseUrl =
  process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:9200";

export const browserApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:9200";

/** Typed client for Server Components. Generated types keep this in step with the backend DTOs. */
export const api = createClient<paths>({ baseUrl: serverApiBaseUrl });

/** Typed client for the browser (the contact form is the only writer on this app). */
export const browserApi = createClient<paths>({ baseUrl: browserApiBaseUrl });

/**
 * The API returns media as a root-relative path (`/api/v1/media/3/content`). The browser needs it
 * absolute, because the site and the API are separate origins.
 */
export function mediaUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  return url.startsWith("http") ? url : `${browserApiBaseUrl}${url}`;
}

/**
 * Every read is uncached and every public page is rendered per request (D-025).
 *
 * <p>Time-based revalidation was tried first and failed the requirement it existed to serve: with
 * an ISR window, an admin edit did not appear on the site for minutes, which is exactly what
 * Sprint 6's DoD forbids. Rendering on demand keeps the guarantee simple — the page a visitor
 * receives always reflects the database at that moment — and costs nothing at a personal site's
 * traffic, where the API call is a local, indexed, small-payload read.
 *
 * <p>SEO is unaffected: crawlers care that the HTML is server-rendered, not that it was rendered
 * ahead of time.
 */
export const noStore = { cache: "no-store" } as const;
