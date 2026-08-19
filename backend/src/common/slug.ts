const MAX_LENGTH = 220;

/**
 * URL slug generation, matching the Java `Slugs` utility so a project keeps the same slug
 * whichever implementation created it.
 */
export function slugify(text: string | null | undefined): string {
  if (!text || !text.trim()) return "";
  const ascii = text.normalize("NFD").replace(/\p{M}+/gu, "");
  const slug = ascii
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > MAX_LENGTH ? slug.slice(0, MAX_LENGTH).replace(/-+$/, "") : slug;
}

/** True when `slug` is already in the canonical form {@link slugify} produces. */
export function isValidSlug(slug: string): boolean {
  return Boolean(slug) && slug.length <= MAX_LENGTH && slug === slugify(slug);
}

/**
 * Finds a free slug by suffixing. Used only for derived slugs: a slug the admin typed explicitly
 * is a 409 when taken, never silently renamed.
 */
export async function uniqueSlug(
  base: string,
  isTaken: (candidate: string) => Promise<boolean>,
): Promise<string> {
  let candidate = base;
  let suffix = 2;
  while (await isTaken(candidate)) {
    candidate = `${base}-${suffix++}`;
  }
  return candidate;
}
