import { Router } from "express";
import { z } from "zod";
import { pool } from "../../db/pool.js";
import { ValidationError } from "../../common/errors.js";
import { ok } from "../../common/api.js";
import { handler, parseBody } from "../../common/http.js";
import { mediaByIds, requireMedia } from "../media/media.service.js";

/**
 * The settings catalogue (D-024): which keys exist, what each holds, its default, and whether it
 * may be served publicly. It lives in code rather than as columns on `site_setting` because
 * public exposure is a security boundary — one an admin could otherwise widen by typing a key
 * name into a form — and because a genuinely new setting always needs frontend code to read it.
 */
type SettingKey = {
  key: string;
  type: "STRING" | "BOOLEAN";
  defaultValue: string;
  isPublic: boolean;
  group: "GENERAL" | "SEO";
};

const SETTINGS: SettingKey[] = [
  { key: "site.title", type: "STRING", defaultValue: "My Portfolio", isPublic: true, group: "GENERAL" },
  { key: "site.tagline", type: "STRING", defaultValue: "", isPublic: true, group: "GENERAL" },
  { key: "site.description", type: "STRING", defaultValue: "", isPublic: true, group: "GENERAL" },
  { key: "site.footer_text", type: "STRING", defaultValue: "", isPublic: true, group: "GENERAL" },
  { key: "site.copyright", type: "STRING", defaultValue: "", isPublic: true, group: "GENERAL" },
  // Where admin notifications go — deliberately private. Publishing a mailbox is what the
  // contact form exists to avoid.
  { key: "contact.notification_email", type: "STRING", defaultValue: "", isPublic: false, group: "GENERAL" },
  // The home page's featured gallery: media ids the admin picks, comma-separated. A setting
  // rather than a column so no migration is needed to curate the home page.
  { key: "home.featured_media_ids", type: "STRING", defaultValue: "", isPublic: true, group: "GENERAL" },
  { key: "nav.show_articles", type: "BOOLEAN", defaultValue: "false", isPublic: true, group: "GENERAL" },
  { key: "nav.show_research", type: "BOOLEAN", defaultValue: "false", isPublic: true, group: "GENERAL" },
  { key: "seo.default_title", type: "STRING", defaultValue: "", isPublic: true, group: "SEO" },
  { key: "seo.default_description", type: "STRING", defaultValue: "", isPublic: true, group: "SEO" },
  { key: "seo.default_og_image_url", type: "STRING", defaultValue: "", isPublic: true, group: "SEO" },
];

const knownKeys = () => SETTINGS.map((setting) => setting.key).sort().join(", ");

const settingsSchema = z.object({ settings: z.record(z.string(), z.string().nullable()) });
const socialLinksSchema = z.object({
  links: z.array(
    z.object({
      platform: z.string().trim().min(1, "must not be blank").max(50),
      url: z.string().trim().min(1, "must not be blank").max(500),
      visible: z.boolean().nullish(),
    }),
  ),
});
const profileSchema = z.object({
  profileImageMediaId: z.number().nullish(),
  resumeMediaId: z.number().nullish(),
});

export const settingsPublicRouter = Router();
export const settingsAdminRouter = Router();

/** Stored values layered over registry defaults, so every known key is always present. */
async function storedValues(): Promise<Map<string, string>> {
  const { rows } = await pool.query<{ key: string; value: string | null }>("SELECT key, value FROM site_setting");
  return new Map(rows.filter((row) => row.value !== null).map((row) => [row.key, row.value!]));
}

async function valuesFor(group: "GENERAL" | "SEO"): Promise<Record<string, string>> {
  const stored = await storedValues();
  const values: Record<string, string> = {};
  for (const setting of SETTINGS.filter((s) => s.group === group)) {
    values[setting.key] = stored.get(setting.key) ?? setting.defaultValue;
  }
  return values;
}

async function visibleSocialLinks(onlyVisible: boolean) {
  const { rows } = await pool.query(
    `SELECT id, platform, url, display_order, is_visible FROM social_link
     ${onlyVisible ? "WHERE is_visible = true" : ""} ORDER BY display_order ASC, id ASC`,
  );
  return rows.map((row: any) => ({
    id: row.id,
    platform: row.platform,
    url: row.url,
    displayOrder: row.display_order,
    visible: row.is_visible,
  }));
}

async function profileResponse() {
  const { rows } = await pool.query<{ profile_image_media_id: number | null; resume_media_id: number | null }>(
    "SELECT profile_image_media_id, resume_media_id FROM site_profile ORDER BY id ASC LIMIT 1",
  );
  const row = rows[0];
  // No row yet is a normal state, not a 404: the site simply has no photo or resume.
  if (!row) return { profileImage: null, resume: null };

  const media = await mediaByIds([row.profile_image_media_id, row.resume_media_id].filter(Boolean) as number[]);
  return {
    profileImage: row.profile_image_media_id ? media.get(row.profile_image_media_id) ?? null : null,
    resume: row.resume_media_id ? media.get(row.resume_media_id) ?? null : null,
  };
}

settingsPublicRouter.get(
  "/settings",
  handler(async (_req, res) => {
    const stored = await storedValues();
    const settings: Record<string, string> = {};
    const seo: Record<string, string> = {};
    for (const setting of SETTINGS.filter((s) => s.isPublic)) {
      const target = setting.group === "SEO" ? seo : settings;
      target[setting.key] = stored.get(setting.key) ?? setting.defaultValue;
    }
    /*
     * The featured gallery is resolved here rather than left as a list of ids: the home page
     * needs each image's URL, alt text and dimensions to lay the grid out, and there is no public
     * endpoint that exposes media metadata — only the bytes. One call, everything the shell needs.
     */
    const featuredIds = (stored.get("home.featured_media_ids") ?? "")
      .split(",")
      .map((value) => Number.parseInt(value.trim(), 10))
      .filter((value) => Number.isInteger(value) && value > 0);
    const featured = await mediaByIds(featuredIds);

    return ok(res, {
      settings,
      seo,
      socialLinks: await visibleSocialLinks(true),
      // Ids the admin listed but which no longer exist simply drop out (D-019).
      featuredMedia: featuredIds.map((id) => featured.get(id)).filter(Boolean),
    });
  }),
);

settingsPublicRouter.get(
  "/settings/profile",
  handler(async (_req, res) => ok(res, await profileResponse())),
);

settingsAdminRouter.get(
  "/admin/settings",
  handler(async (_req, res) => ok(res, { settings: await valuesFor("GENERAL") })),
);

settingsAdminRouter.put(
  "/admin/settings",
  handler(async (req, res) => {
    await applySettings(parseBody(settingsSchema, req.body).settings, "GENERAL");
    return ok(res, { settings: await valuesFor("GENERAL") }, "Settings updated");
  }),
);

settingsAdminRouter.get(
  "/admin/settings/seo",
  handler(async (_req, res) => ok(res, { settings: await valuesFor("SEO") })),
);

settingsAdminRouter.put(
  "/admin/settings/seo",
  handler(async (req, res) => {
    await applySettings(parseBody(settingsSchema, req.body).settings, "SEO");
    return ok(res, { settings: await valuesFor("SEO") }, "SEO defaults updated");
  }),
);

settingsAdminRouter.get(
  "/admin/settings/social-links",
  handler(async (_req, res) => ok(res, await visibleSocialLinks(false))),
);

settingsAdminRouter.put(
  "/admin/settings/social-links",
  handler(async (req, res) => {
    const { links } = parseBody(socialLinksSchema, req.body);
    // Replaced wholesale: it is a short ordered list the admin edits as a whole, and rewriting it
    // keeps display_order consistent with the order actually sent.
    await pool.query("DELETE FROM social_link");
    for (const [index, link] of links.entries()) {
      await pool.query(
        "INSERT INTO social_link (platform, url, display_order, is_visible) VALUES ($1, $2, $3, $4)",
        [link.platform.trim(), link.url.trim(), index, link.visible !== false],
      );
    }
    return ok(res, await visibleSocialLinks(false), "Social links updated");
  }),
);

settingsAdminRouter.get(
  "/admin/settings/profile",
  handler(async (_req, res) => ok(res, await profileResponse())),
);

settingsAdminRouter.put(
  "/admin/settings/profile",
  handler(async (req, res) => {
    const body = parseBody(profileSchema, req.body);
    const photoId = await requireMedia(body.profileImageMediaId ?? null, "profileImageMediaId");
    const resumeId = await requireMedia(body.resumeMediaId ?? null, "resumeMediaId");

    const { rows } = await pool.query<{ id: number }>("SELECT id FROM site_profile ORDER BY id ASC LIMIT 1");
    if (rows[0]) {
      await pool.query(
        "UPDATE site_profile SET profile_image_media_id = $1, resume_media_id = $2, updated_at = now() WHERE id = $3",
        [photoId, resumeId, rows[0].id],
      );
    } else {
      await pool.query(
        "INSERT INTO site_profile (profile_image_media_id, resume_media_id) VALUES ($1, $2)",
        [photoId, resumeId],
      );
    }
    return ok(res, await profileResponse(), "Profile updated");
  }),
);

async function applySettings(values: Record<string, string | null>, group: "GENERAL" | "SEO"): Promise<void> {
  for (const [name, value] of Object.entries(values)) {
    const setting = SETTINGS.find((candidate) => candidate.key === name);
    if (!setting) {
      throw new ValidationError(`Unknown setting '${name}'. Known settings: ${knownKeys()}`);
    }
    if (setting.group !== group) {
      throw new ValidationError(
        `Setting '${name}' belongs to the ${setting.group} group and cannot be changed here`,
      );
    }
    if (value === null) {
      // Reset: dropping the row makes the key read as its registry default again.
      await pool.query("DELETE FROM site_setting WHERE key = $1", [name]);
      continue;
    }
    // The column is untyped TEXT, so the registry's declared type is the only thing between a
    // typo and a frontend that reads "yes" as a boolean and renders nothing.
    if (setting.type === "BOOLEAN" && value !== "true" && value !== "false") {
      throw new ValidationError(`Setting '${name}' must be true or false`);
    }
    await pool.query(
      `INSERT INTO site_setting (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [name, value],
    );
  }
  console.info(`Settings updated: group=${group} keys=${Object.keys(values).join(",")}`);
}
