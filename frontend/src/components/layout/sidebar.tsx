import Image from "next/image";
import Link from "next/link";
import { mediaUrl } from "@/lib/api";
import { getProfile, getSettings, setting } from "@/lib/content";
import { SiteNav, type NavItem } from "@/components/layout/site-nav";
import { SocialIcon } from "@/components/social-icon";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * The fixed left sidebar the Phase 10/11 design settled on: identity, nav, resume button and
 * social links. Every value comes from Settings (D-024) — nothing here is hardcoded, which is the
 * whole point of `GET /api/v1/settings` existing.
 *
 * <p>Its surface is translucent so the page's glow reads across the full width of the window, the
 * way it does in the reference frame. An opaque column would cut the gradient off at 288px and
 * leave a visible seam down the side of the page.
 */
export async function Sidebar() {
  const [settings, profile] = await Promise.all([getSettings(), getProfile()]);

  const title = setting(settings, "site.title", "Portfolio");
  const tagline = setting(settings, "site.tagline");
  const photo = mediaUrl(profile.profileImage?.url);
  const resume = mediaUrl(profile.resume?.url);

  /*
   * The mockup's nav plus Skills, which now carries skills, certifications and problem-solving
   * profiles as a section of its own. Experience and Education stay off the menu — they are
   * presented on About, so an entry each would be a second route to the same content. Their pages still
   * exist and remain reachable by URL — this removes the menu items, not the pages.
   */
  const items: NavItem[] = [
    { href: "/", label: "Home" },
    { href: "/about", label: "About" },
    { href: "/projects", label: "Projects" },
    { href: "/skills", label: "Skills" },
    { href: "/research", label: "Research" },
    { href: "/articles", label: "Articles" },
    { href: "/contact", label: "Contact" },
  ];

  return (
    <aside className="flex w-full shrink-0 flex-col gap-6 border-b border-border bg-surface/70 p-6 backdrop-blur-xl md:sticky md:top-0 md:h-screen md:w-72 md:border-b-0 md:border-r">
      <Link href="/" className="flex items-center gap-3">
        {photo ? (
          <Image
            src={photo}
            alt={profile.profileImage?.altText || `${title} profile photo`}
            width={48}
            height={48}
            unoptimized
            className="h-12 w-12 rounded-full border border-border object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="grid h-12 w-12 place-items-center rounded-full bg-accent-soft font-display text-lg font-semibold text-accent"
          >
            {title.slice(0, 1)}
          </span>
        )}
        <span>
          <span className="block font-display text-base font-semibold">{title}</span>
          {tagline ? <span className="block text-xs text-muted">{tagline}</span> : null}
        </span>
      </Link>

      <SiteNav items={items} />

      <div className="mt-auto flex flex-col gap-4">
        <ThemeToggle />
        {resume ? (
          <a
            href={resume}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            Download resume
          </a>
        ) : null}

        {settings.socialLinks?.length ? (
          <ul className="flex flex-wrap items-center gap-2" aria-label="Social links">
            {settings.socialLinks.map((link) => (
              <li key={link.id}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer noopener me"
                  aria-label={link.platform}
                  title={link.platform}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted transition hover:border-accent hover:text-accent"
                >
                  <SocialIcon platform={link.platform} />
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </aside>
  );
}
