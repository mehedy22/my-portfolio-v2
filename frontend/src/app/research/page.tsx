import type { Metadata } from "next";
import { mediaUrl } from "@/lib/api";
import { getResearch } from "@/lib/content";
import { TrackPageView } from "@/components/track-page-view";
import { Card, Chip, EmptyState } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Research",
  description: "Papers and technical write-ups I've published or contributed to.",
  alternates: { canonical: "/research" },
};

/**
 * Laid out as the mockup draws it: a card per entry with the title and date on one line, the
 * abstract beneath, and tags opposite the link out.
 *
 * <p>There is no detail route on purpose (D-014) — a research entry points at a paper hosted
 * elsewhere or an uploaded PDF, so the list item is the whole thing.
 */
export default async function ResearchPage() {
  const entries = await getResearch();

  return (
    <div className="mx-auto max-w-6xl">
      <TrackPageView path="/research" />

      <header className="mb-10">
        <Chip>Research</Chip>
        <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight">Research</h1>
        <p className="mt-3 text-muted">
          Papers and technical write-ups I&rsquo;ve published or contributed to.
        </p>
      </header>

      {entries.length === 0 ? (
        <EmptyState message="Nothing published yet." />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {entries.map((entry) => {
            const pdf = mediaUrl(entry.pdf?.url);
            const link = entry.externalUrl || pdf;
            return (
              <Card key={entry.id} className="p-6">
                <div className="mb-2.5 flex items-start justify-between gap-4">
                  <h2 className="font-display text-lg font-semibold leading-snug">{entry.title}</h2>
                  {entry.publicationDate ? (
                    <span className="shrink-0 pt-0.5 text-xs text-muted">
                      {new Date(entry.publicationDate).toLocaleDateString("en-GB", {
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  ) : null}
                </div>

                <p className="mb-4 text-sm leading-relaxed text-muted">
                  {entry.abstractText}
                  {entry.publicationVenue ? ` ${entry.publicationVenue}.` : ""}
                </p>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-1.5">
                    {entry.tags?.map((tag: string) => (
                      <Chip key={tag}>{tag}</Chip>
                    ))}
                  </div>
                  {link ? (
                    <a
                      href={link}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
                    >
                      {entry.externalUrl ? "View paper" : "Download PDF"}
                      <span aria-hidden>→</span>
                    </a>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
