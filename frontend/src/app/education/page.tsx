import type { Metadata } from "next";
import Image from "next/image";
import { mediaUrl } from "@/lib/api";
import { getEducation } from "@/lib/content";
import { Card, DateRange, EmptyState, PageHeader } from "@/components/ui/primitives";
import { TrackPageView } from "@/components/track-page-view";

/** Rendered per request so an admin edit is visible immediately (D-025). */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Education", description: "Academic background.",
  alternates: { canonical: "/education" },
};

export default async function EducationPage() {
  const entries = await getEducation();

  return (
    <>
      <TrackPageView path="/education" />
      <div className="mx-auto max-w-3xl">
      <PageHeader title="Education" />
      {entries.length === 0 ? (
        <EmptyState message="Nothing published yet." />
      ) : (
        <ol className="flex flex-col gap-5">
          {entries.map((entry) => {
            const logo = mediaUrl(entry.logo?.url);
            return (
              <li key={entry.id}>
                <Card>
                  <div className="flex items-start gap-4">
                    {logo ? (
                      <Image
                        src={logo}
                        alt={entry.logo?.altText || `${entry.institution} logo`}
                        width={48}
                        height={48}
                        unoptimized
                        className="h-12 w-12 rounded-lg border border-border object-contain"
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <h2 className="font-display text-lg font-semibold">{entry.institution}</h2>
                      {entry.degree || entry.field ? (
                        <p className="text-sm text-accent">
                          {[entry.degree, entry.field].filter(Boolean).join(" · ")}
                        </p>
                      ) : null}
                      <DateRange
                        start={entry.startDate}
                        end={entry.endDate}
                        current={entry.currentlyStudying}
                        currentLabel="Ongoing"
                      />
                      {entry.result ? (
                        <p className="mt-1.5 text-sm text-muted">
                          Result <span className="font-medium text-text">{entry.result}</span>
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {entry.description ? (
                    <p className="mt-4 whitespace-pre-line text-sm text-muted">{entry.description}</p>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ol>
      )}
    </div>
    </>
  );
}
