import type { Metadata } from "next";
import Image from "next/image";
import { mediaUrl } from "@/lib/api";
import {
  getEducation,
  getExperience,
  getProfile,
  getSettings,
  setting,
} from "@/lib/content";
import { TrackPageView } from "@/components/track-page-view";
import { ButtonLink, Card, Chip, EmptyState } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const name = setting(settings, "site.title", "Portfolio");
  const description =
    setting(settings, "site.description") ||
    setting(settings, "site.tagline") ||
    `About ${name} — background, experience and skills.`;
  return { title: "About", description, alternates: { canonical: "/about" } };
}

/**
 * Laid out as the published mockup has it: a two-column intro, then Experience as a dated
 * timeline, then Education. Skills, certifications and problem-solving profiles have moved to
 * their own page and are linked from here.
 */
export default async function AboutPage() {
  const [settings, profile, roles, education] = await Promise.all([
    getSettings(),
    getProfile(),
    getExperience(),
    getEducation(),
  ]);

  const name = setting(settings, "site.title", "Portfolio");
  const tagline = setting(settings, "site.tagline");
  const description = setting(settings, "site.description");
  const photo = mediaUrl(profile.profileImage?.url);
  const resume = mediaUrl(profile.resume?.url);

  const isEmpty = !description && roles.length === 0 && education.length === 0;

  return (
    <div className="mx-auto max-w-6xl">
      <TrackPageView path="/about" />

      {/* Intro — image left, text right, as the mockup lays it out. */}
      <section className="grid gap-12 sm:grid-cols-[1fr_1.6fr] sm:items-start">
        <div className="relative aspect-square w-full overflow-hidden rounded-3xl border border-border bg-surface">
          {photo ? (
            <Image
              src={photo}
              alt={profile.profileImage?.altText || `${name} profile photo`}
              fill
              unoptimized
              sizes="(max-width: 640px) 100vw, 320px"
              className="object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="grid h-full w-full place-items-center font-display text-6xl font-semibold text-accent/30"
            >
              {name.slice(0, 1)}
            </span>
          )}
        </div>

        <div>
          <Chip>About me</Chip>
          <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {tagline || name}
          </h1>
          {description ? (
            <p className="mt-5 whitespace-pre-line text-base leading-8 text-muted">{description}</p>
          ) : null}
          {resume ? (
            <div className="mt-7">
              <ButtonLink href={resume} external>
                Download resume
              </ButtonLink>
            </div>
          ) : null}
        </div>
      </section>

      {isEmpty ? (
        <div className="mt-14">
          <EmptyState message="Nothing published yet." />
        </div>
      ) : null}

      {roles.length > 0 ? (
        /*
          Cards, each led by the company's logo — the logo the schema has carried since V5 and
          this page never drew, which is why a portfolio full of uploaded logos still showed
          none. Two abreast on a wide screen and one per row below it, so a role gets a block
          with room for its description instead of the thin strip beside a date column that this
          section used to be.
        */
        <section className="mt-16">
          <Chip>Experience</Chip>
          <ol className="mt-6 gap-5 lg:columns-2">
            {roles.map((role) => {
              const logo = mediaUrl(role.companyLogo?.url);
              return (
                <li key={role.id} className="mb-5 break-inside-avoid">
                  <Card className="flex gap-5 p-6 sm:gap-6 sm:p-7">
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-border bg-accent-soft sm:h-20 sm:w-20">
                      {logo ? (
                        <Image
                          src={logo}
                          alt={role.companyLogo?.altText || `${role.company} logo`}
                          fill
                          unoptimized
                          sizes="80px"
                          className="object-contain p-2"
                        />
                      ) : (
                        // No logo uploaded yet — an initial keeps this card aligned with the ones
                        // that have one, exactly as the education rows do.
                        <span className="font-display grid h-full w-full place-items-center text-2xl font-semibold text-accent">
                          {role.company?.trim().charAt(0).toUpperCase() ?? "·"}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-lg font-semibold sm:text-xl">
                        {role.position}
                      </h3>
                      <p className="mt-1 text-sm text-accent">{role.company}</p>
                      <p className="mt-1 text-sm text-muted">
                        {formatRange(role.startDate, role.endDate, role.currentlyWorking, "Present")}
                        {role.employmentType
                          ? ` · ${role.employmentType.replace("_", " ").toLowerCase()}`
                          : ""}
                      </p>
                      {role.description ? (
                        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted">
                          {role.description}
                        </p>
                      ) : null}
                      {role.technologies?.length ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {role.technologies.map((tech) => (
                            <Chip key={tech}>{tech}</Chip>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      {education.length > 0 ? (
        <section className="mt-16">
          <Chip>Education</Chip>
          <div className="mt-6 flex flex-col gap-5">
            {education.map((entry) => {
              const logo = mediaUrl(entry.logo?.url);
              return (
                <Card key={entry.id} className="flex gap-5 p-6 sm:gap-6 sm:p-7">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-border bg-accent-soft sm:h-20 sm:w-20">
                    {logo ? (
                      <Image
                        src={logo}
                        alt={entry.logo?.altText || `${entry.institution} logo`}
                        fill
                        unoptimized
                        sizes="80px"
                        className="object-contain p-2"
                      />
                    ) : (
                      // No logo uploaded yet — an initial keeps the row aligned with the ones that have one.
                      <span className="font-display grid h-full w-full place-items-center text-2xl font-semibold text-accent">
                        {entry.institution?.trim().charAt(0).toUpperCase() ?? "·"}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-lg font-semibold sm:text-xl">
                      {[entry.degree, entry.field].filter(Boolean).join(" · ") || entry.institution}
                    </h3>
                    <p className="mt-1 text-sm text-accent">
                      {entry.institution}
                      {entry.startDate || entry.endDate
                        ? ` — ${formatRange(entry.startDate, entry.endDate, entry.currentlyStudying, "Ongoing")}`
                        : ""}
                    </p>
                    {entry.description ? (
                      <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted">
                        {entry.description}
                      </p>
                    ) : null}
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      ) : null}

      {/*
        Skills, certifications and problem-solving profiles live on their own page now: together
        they are a body of evidence in their own right, and burying them under a biography made
        each one harder to scan.
      */}
      <section className="mt-16">
        <a
          href="/skills"
          className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-6 transition hover:border-accent"
        >
          <div>
            <h2 className="font-display text-lg font-semibold">Skills &amp; problem solving</h2>
            <p className="mt-1 text-sm text-muted">
              Technical skills, certifications and competitive-programming profiles.
            </p>
          </div>
          <span aria-hidden className="text-accent">
            &rarr;
          </span>
        </a>
      </section>
    </div>
  );
}

function formatYear(value?: string): string {
  return value ? new Date(value).getFullYear().toString() : "";
}

/** "2023 — Present", the way the mockup's timeline column reads. */
function formatRange(
  start?: string,
  end?: string,
  current?: boolean,
  currentLabel = "Present",
): string {
  const from = formatYear(start);
  const to = current ? currentLabel : formatYear(end);
  return [from, to].filter(Boolean).join(" — ");
}
