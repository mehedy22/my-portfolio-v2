import { api, noStore } from "@/lib/api";
import type { components } from "@/generated/api/schema";

type Schemas = components["schemas"];

export type PublicSettings = Schemas["PublicSettingsResponse"];
export type SiteProfile = Schemas["SiteProfileResponse"];
export type ProjectSummary = Schemas["ProjectSummaryResponse"];
export type Project = Schemas["ProjectResponse"];
export type Experience = Schemas["ExperienceResponse"];
export type SkillGroup = Schemas["SkillGroupResponse"];
export type Education = Schemas["EducationResponse"];
export type Certification = Schemas["CertificationResponse"];
export type SocialLink = Schemas["SocialLinkResponse"];
export type ArticleSummary = Schemas["ArticleSummaryResponse"];
export type Article = Schemas["ArticleResponse"];
export type Achievement = Schemas["AchievementResponse"];
export type Research = Schemas["ResearchResponse"];
export type ProblemSolvingProfile = Schemas["ProblemSolvingProfileResponse"];
export type Media = Schemas["MediaResponse"];

/** Uncached: see D-025 in lib/api.ts. */
const cache = noStore;

/**
 * Reads never throw: a public page must still render its shell if one endpoint is unavailable —
 * an empty Projects list is a far better failure than a 500 page
 * (docs/10-frontend/ux-states-and-quality.md).
 */
async function read<T>(load: () => Promise<{ data?: { data?: T } }>, fallback: T): Promise<T> {
  try {
    const { data } = await load();
    return data?.data ?? fallback;
  } catch {
    return fallback;
  }
}

export const emptySettings: PublicSettings = { settings: {}, seo: {}, socialLinks: [] };

export function getSettings(): Promise<PublicSettings> {
  return read(() => api.GET("/api/v1/settings", cache), emptySettings);
}

export function getProfile(): Promise<SiteProfile> {
  return read(() => api.GET("/api/v1/settings/profile", cache), {});
}

export function getProjects(search?: string): Promise<ProjectSummary[]> {
  return read(
    () => api.GET("/api/v1/projects", { params: { query: search ? { search } : {} }, ...cache }),
    [],
  );
}

export function getAchievements(): Promise<Achievement[]> {
  return read(() => api.GET("/api/v1/achievements", cache), []);
}

export function getResearch(): Promise<Research[]> {
  return read(() => api.GET("/api/v1/research", cache), []);
}

export function getProblemSolving(): Promise<ProblemSolvingProfile[]> {
  return read(() => api.GET("/api/v1/problem-solving", cache), []);
}

/**
 * The images the admin curated for the home page, already resolved to full media objects by the
 * settings endpoint — the grid needs each one's dimensions to decide how it sits.
 */
export function featuredMedia(settings: PublicSettings): Media[] {
  return (settings.featuredMedia ?? []) as Media[];
}

/**
 * Groups images the way the mockup lays them out: a portrait image occupies a tall tile, a
 * landscape one a wide tile. "Type" here is the shape of the picture, which is the only thing the
 * media record actually knows about it — see the note in the home page.
 */
export type ImageShape = "portrait" | "landscape" | "square";

export function shapeOf(media: Media): ImageShape {
  const width = media.width ?? 0;
  const height = media.height ?? 0;
  if (!width || !height) return "landscape";
  const ratio = width / height;
  if (ratio < 0.9) return "portrait";
  if (ratio > 1.1) return "landscape";
  return "square";
}

export function getExperience(): Promise<Experience[]> {
  return read(() => api.GET("/api/v1/experience", cache), []);
}

export function getSkills(): Promise<SkillGroup[]> {
  return read(() => api.GET("/api/v1/skills", cache), []);
}

export function getEducation(): Promise<Education[]> {
  return read(() => api.GET("/api/v1/education", cache), []);
}

export function getCertifications(): Promise<Certification[]> {
  return read(() => api.GET("/api/v1/certifications", cache), []);
}

export async function getArticles(
  params: { category?: string; tag?: string; search?: string; page?: number } = {},
) {
  try {
    const { data } = await api.GET("/api/v1/articles", {
      params: {
        query: {
          page: params.page ?? 0,
          size: 10,
          category: params.category,
          tag: params.tag,
          search: params.search,
        },
      },
      ...cache,
    });
    return data?.data ?? { content: [], page: 0, size: 10, totalElements: 0, totalPages: 0 };
  } catch {
    return { content: [], page: 0, size: 10, totalElements: 0, totalPages: 0 };
  }
}

/** Null when unknown, still a draft, or scheduled but not yet due — all 404 from the API. */
export async function getArticle(slug: string): Promise<Article | null> {
  try {
    const { data } = await api.GET("/api/v1/articles/{slug}", { params: { path: { slug } }, ...cache });
    return data?.data ?? null;
  } catch {
    return null;
  }
}

/** Null when the slug is unknown or unpublished — the backend answers 404 for both (D-021 era). */
export async function getProject(slug: string): Promise<Project | null> {
  try {
    const { data } = await api.GET("/api/v1/projects/{slug}", {
      params: { path: { slug } },
      ...cache,
    });
    return data?.data ?? null;
  } catch {
    return null;
  }
}

/** A setting, falling back to the supplied default when unset or unavailable. */
export function setting(settings: PublicSettings, key: string, fallback = ""): string {
  return settings.settings?.[key]?.trim() || fallback;
}

export function flag(settings: PublicSettings, key: string): boolean {
  return settings.settings?.[key] === "true";
}
