import type { MetadataRoute } from "next";
import { getArticles, getProjects } from "@/lib/content";

/** Rendered per request so an admin edit is visible immediately (D-025). */
export const dynamic = "force-dynamic";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * Generated from published content on each request rather than hand-maintained, per the Phase 10
 * SEO plan — a newly published project appears without anyone editing a file.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = [
    "",
    "/about",
    "/projects",
    "/experience",
    "/skills",
    "/education",
    "/certifications",
    "/articles",
    "/contact",
  ].map((path) => ({ url: `${siteUrl}${path}`, lastModified: new Date() }));

  const [projects, articles] = await Promise.all([getProjects(), getArticles({ page: 0 })]);

  return [
    ...staticRoutes,
    ...projects.map((project) => ({
      url: `${siteUrl}/projects/${project.slug}`,
      lastModified: new Date(),
    })),
    // Only published, already-due articles are returned by the API, so nothing unreleased leaks
    // into the sitemap.
    ...(articles.content ?? []).map((article) => ({
      url: `${siteUrl}/articles/${article.slug}`,
      lastModified: article.publishedAt ? new Date(article.publishedAt) : new Date(),
    })),
  ];
}
