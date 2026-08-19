import type { Metadata } from "next";
import Image from "next/image";
import { mediaUrl } from "@/lib/api";
import { getExperience } from "@/lib/content";
import { Card, Chip, DateRange, EmptyState, PageHeader } from "@/components/ui/primitives";
import { TrackPageView } from "@/components/track-page-view";

/** Rendered per request so an admin edit is visible immediately (D-025). */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Experience", description: "Roles and responsibilities.",
  alternates: { canonical: "/experience" },
};

export default async function ExperiencePage() {
  const roles = await getExperience();

  return (
    <>
      <TrackPageView path="/experience" />
      <div className="mx-auto max-w-3xl">
      <PageHeader title="Experience" lead="Where I have worked and what I did there." />
      {roles.length === 0 ? (
        <EmptyState message="Nothing published yet." />
      ) : (
        <ol className="flex flex-col gap-5">
          {roles.map((role) => {
            const logo = mediaUrl(role.companyLogo?.url);
            return (
              <li key={role.id}>
                <Card>
                  <div className="flex items-start gap-4">
                    {logo ? (
                      <Image
                        src={logo}
                        alt={role.companyLogo?.altText || `${role.company} logo`}
                        width={48}
                        height={48}
                        unoptimized
                        className="h-12 w-12 rounded-lg border border-border object-contain"
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <h2 className="font-display text-lg font-semibold">{role.position}</h2>
                      <p className="text-sm text-accent">{role.company}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-3">
                        <DateRange
                          start={role.startDate}
                          end={role.endDate}
                          current={role.currentlyWorking}
                        />
                        {role.employmentType ? (
                          <span className="text-xs text-muted">
                            {role.employmentType.replace("_", " ").toLowerCase()}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  {role.description ? (
                    <p className="mt-4 whitespace-pre-line text-sm text-muted">{role.description}</p>
                  ) : null}
                  {role.responsibilities ? (
                    <p className="mt-3 whitespace-pre-line text-sm text-muted">
                      {role.responsibilities}
                    </p>
                  ) : null}
                  {role.technologies?.length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {role.technologies.map((tech) => (
                        <Chip key={tech}>{tech}</Chip>
                      ))}
                    </div>
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
