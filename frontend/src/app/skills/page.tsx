import type { Metadata } from "next";
import { getCertifications, getProblemSolving, getSkills } from "@/lib/content";
import { TrackPageView } from "@/components/track-page-view";
import { ButtonLink, Card, Chip, EmptyState, PageHeader } from "@/components/ui/primitives";
import { SocialIcon } from "@/components/social-icon";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Skills",
  description: "Technical skills, certifications and competitive-programming profiles.",
  alternates: { canonical: "/skills" },
};

/** Proficiency is a word in the data and a bar on the page; this is the mapping between them. */
const PROFICIENCY_WIDTH: Record<string, string> = {
  EXPERT: "92%",
  ADVANCED: "82%",
  INTERMEDIATE: "64%",
  BEGINNER: "45%",
};

/**
 * Skills, certifications and problem-solving profiles on one page.
 *
 * <p>They belong together because they answer the same question from three directions — what this
 * person can do, who has verified it, and where the work is demonstrable — which is why they were
 * moved off the About page.
 */
export default async function SkillsPage() {
  const [groups, certifications, profiles] = await Promise.all([
    getSkills(),
    getCertifications(),
    getProblemSolving(),
  ]);

  const isEmpty = groups.length === 0 && certifications.length === 0 && profiles.length === 0;

  return (
    <div className="mx-auto max-w-4xl">
      <TrackPageView path="/skills" />
      <PageHeader
        title="Skills"
        lead="What I work with, what has been certified, and where the problem solving is on show."
      />

      {isEmpty ? <EmptyState message="Nothing published yet." /> : null}

      {groups.length > 0 ? (
        <section aria-labelledby="skills-heading">
          <h2 id="skills-heading" className="sr-only">
            Technical skills
          </h2>
          <div className="grid gap-8 sm:grid-cols-2">
            {groups.map((group) => (
              <div key={group.category}>
                <Chip>{group.category}</Chip>
                <div className="mt-4 flex flex-col gap-3">
                  {group.skills?.map((skill) => (
                    <div key={skill.id}>
                      <div className="mb-1.5 flex justify-between text-sm">
                        <span>{skill.name}</span>
                        <span className="text-muted">
                          {skill.proficiency ? skill.proficiency.toLowerCase() : ""}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-accent-soft">
                        <div
                          className="h-1.5 rounded-full bg-accent"
                          style={{
                            width: skill.proficiency
                              ? PROFICIENCY_WIDTH[skill.proficiency] ?? "60%"
                              : "60%",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {profiles.length > 0 ? (
        <section className="mt-16" aria-labelledby="problem-solving-heading">
          <h2 id="problem-solving-heading" className="font-display text-2xl font-semibold">
            Problem solving
          </h2>
          <p className="mt-1.5 text-sm text-muted">
            Judge profiles — the handle is the account, so the claims are checkable.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {profiles.map((profile) => {
              const body = (
                <>
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl border border-border text-accent">
                      <SocialIcon platform={profile.platform} size={18} />
                    </span>
                    <div className="min-w-0">
                      <p className="font-display text-base font-semibold">{profile.platform}</p>
                      {/* The judge id, shown as an id — monospaced so it reads as a handle. */}
                      <p className="truncate font-mono text-xs text-muted">@{profile.handle}</p>
                    </div>
                  </div>

                  {profile.problemsSolved || profile.rating || profile.rankTitle ? (
                    <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                      {profile.problemsSolved ? (
                        <div>
                          <dt className="text-xs uppercase tracking-wide text-muted">Solved</dt>
                          <dd className="font-display text-lg font-semibold">
                            {profile.problemsSolved.toLocaleString("en-GB")}
                          </dd>
                        </div>
                      ) : null}
                      {profile.rating ? (
                        <div>
                          <dt className="text-xs uppercase tracking-wide text-muted">Rating</dt>
                          <dd className="font-display text-lg font-semibold">{profile.rating}</dd>
                        </div>
                      ) : null}
                      {profile.rankTitle ? (
                        <div>
                          <dt className="text-xs uppercase tracking-wide text-muted">Rank</dt>
                          <dd className="font-display text-lg font-semibold">{profile.rankTitle}</dd>
                        </div>
                      ) : null}
                    </dl>
                  ) : null}
                </>
              );

              return (
                <Card key={profile.id} className="p-5">
                  {profile.profileUrl ? (
                    <a
                      href={profile.profileUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="block transition hover:text-accent"
                    >
                      {body}
                    </a>
                  ) : (
                    body
                  )}
                </Card>
              );
            })}
          </div>
        </section>
      ) : null}

      {certifications.length > 0 ? (
        <section className="mt-16" aria-labelledby="certifications-heading">
          <h2 id="certifications-heading" className="font-display text-2xl font-semibold">
            Certifications
          </h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {certifications.map((certification) => (
              <Card key={certification.id} className="p-5">
                <h3 className="font-display text-base font-semibold">{certification.name}</h3>
                <p className="mt-1 text-sm text-accent">{certification.issuer}</p>
                {certification.issueDate ? (
                  <p className="mt-1 text-sm text-muted">
                    Issued{" "}
                    {new Date(certification.issueDate).toLocaleDateString("en-GB", {
                      month: "short",
                      year: "numeric",
                    })}
                    {certification.expiryDate
                      ? ` · expires ${new Date(certification.expiryDate).toLocaleDateString("en-GB", {
                          month: "short",
                          year: "numeric",
                        })}`
                      : ""}
                  </p>
                ) : null}
                {certification.description ? (
                  <p className="mt-3 text-sm text-muted">{certification.description}</p>
                ) : null}
                {certification.credentialUrl ? (
                  <div className="mt-4">
                    <ButtonLink href={certification.credentialUrl} external variant="ghost">
                      Verify
                    </ButtonLink>
                  </div>
                ) : null}
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
