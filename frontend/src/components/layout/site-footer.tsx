import { getSettings, setting } from "@/lib/content";
import { SocialIcon } from "@/components/social-icon";

export async function SiteFooter() {
  const settings = await getSettings();
  const footerText = setting(settings, "site.footer_text");
  const copyright =
    setting(settings, "site.copyright") ||
    `© ${new Date().getFullYear()} ${setting(settings, "site.title", "Portfolio")}`;
  const links = settings.socialLinks ?? [];

  return (
    /*
      Sits on --bg2 rather than the page background, so the footer reads as its own band instead
      of trailing off the end of the content. The top border stays: on the dot-grid background the
      tint alone is subtle, and the rule is what makes the edge definite.
    */
    <footer className="mt-16 border-t border-border bg-footer px-6 py-10 text-sm text-muted sm:px-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p>{copyright}</p>
        {footerText ? <p>{footerText}</p> : null}

        {links.length ? (
          <ul className="flex items-center gap-4">
            {links.map((link) => (
              <li key={link.id}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer noopener me"
                  // The icon is decorative; the accessible name comes from the platform, so a
                  // screen reader hears "GitHub", not "link".
                  aria-label={link.platform}
                  title={link.platform}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border transition hover:border-accent hover:text-accent"
                >
                  <SocialIcon platform={link.platform} />
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </footer>
  );
}
