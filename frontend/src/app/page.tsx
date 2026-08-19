import type { Metadata } from "next";
import Image from "next/image";
import { mediaUrl } from "@/lib/api";
import { featuredMedia, getSettings, setting, shapeOf } from "@/lib/content";
import { TrackPageView } from "@/components/track-page-view";
import { ButtonLink, EmptyState } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

/**
 * Home gets its own metadata rather than inheriting the layout's template, so the landing page
 * reads as a name rather than "Portfolio · Portfolio" (FR-11).
 */
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const title = setting(settings, "site.title", "Portfolio");
  const description =
    setting(settings, "site.description") || setting(settings, "site.tagline") || undefined;
  return { title: { absolute: title }, description, alternates: { canonical: "/" } };
}

export default async function HomePage() {
  const settings = await getSettings();

  const title = setting(settings, "site.title", "Portfolio");
  const tagline = setting(settings, "site.tagline");
  const description = setting(settings, "site.description");
  const featured = featuredMedia(settings);

  return (
    <>
      <TrackPageView path="/" />

      {/* JSON-LD Person schema, per the Phase 10 SEO plan. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Person",
            name: title,
            jobTitle: tagline || undefined,
            description: description || undefined,
            sameAs: settings.socialLinks?.map((link) => link.url),
          }),
        }}
      />

      {/*
        Centred identity, no portrait — the sidebar already carries the photo, and repeating it
        here competed with the name for the same glance.
      */}
      <section className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-6xl">{title}</h1>
        {tagline ? <p className="mt-4 text-lg text-accent sm:text-xl">{tagline}</p> : null}
        {description ? (
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            {description}
          </p>
        ) : null}
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/projects">View projects</ButtonLink>
          <ButtonLink href="/contact" variant="ghost">
            Contact me
          </ButtonLink>
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-5xl" aria-labelledby="featured-heading">
        <div className="mb-7">
          <h2 id="featured-heading" className="font-display text-2xl font-semibold">
            Featured
          </h2>
          <p className="mt-1.5 text-sm text-muted">A few of my own shots and moments.</p>
        </div>

        {featured.length === 0 ? (
          <EmptyState message="No featured images yet." />
        ) : (
          /*
            The mockup's mixed grid: most tiles are one row, some are two. Which is which is
            decided by the picture itself — a portrait image gets the tall tile, because cropping
            one into a wide tile is what makes a gallery look wrong.
          */
          <div className="grid auto-rows-[150px] grid-cols-2 gap-3.5 sm:grid-cols-3">
            {featured.map((media) => {
              const shape = shapeOf(media);
              const url = mediaUrl(media.url);
              return (
                <figure
                  key={media.id}
                  className={`group relative overflow-hidden rounded-2xl border border-border bg-surface ${
                    shape === "portrait" ? "row-span-2" : ""
                  }`}
                >
                  {url ? (
                    <Image
                      src={url}
                      alt={media.altText || ""}
                      fill
                      unoptimized
                      sizes="(max-width: 640px) 50vw, 33vw"
                      className="object-cover transition duration-300 group-hover:scale-[1.03]"
                    />
                  ) : null}
                  {media.altText ? (
                    <figcaption className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-black/70 to-transparent px-3 py-2 text-xs text-white transition group-hover:translate-y-0">
                      {media.altText}
                    </figcaption>
                  ) : null}
                </figure>
              );
            })}
          </div>
        )}
      </section>

      <section className="mx-auto mt-20 max-w-5xl rounded-3xl border border-border bg-gradient-to-br from-accent-soft to-cyan-soft p-10 sm:p-13">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <h2 className="font-display text-2xl font-semibold">Have a project in mind?</h2>
            <p className="mt-2 text-sm text-muted">
              Always open to discussing new opportunities.
            </p>
          </div>
          <ButtonLink href="/contact">Get in touch</ButtonLink>
        </div>
      </section>
    </>
  );
}
