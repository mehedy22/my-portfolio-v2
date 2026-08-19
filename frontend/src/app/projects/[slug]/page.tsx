import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { mediaUrl } from "@/lib/api";
import { getProject } from "@/lib/content";
import { ButtonLink, Chip, DateRange } from "@/components/ui/primitives";
import { TrackPageView } from "@/components/track-page-view";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) return { title: "Not found" };
  const image = mediaUrl(project.thumbnail?.url);
  return {
    title: project.title,
    description: project.shortDescription,
    alternates: { canonical: `/projects/${project.slug}` },
    openGraph: {
      title: project.title,
      description: project.shortDescription,
      type: "article",
      images: image ? [image] : undefined,
    },
  };
}

export default async function ProjectDetailPage({ params }: Props) {
  const { slug } = await params;
  const project = await getProject(slug);

  // A draft and a nonexistent slug are the same 404 here, exactly as the API treats them.
  if (!project) notFound();

  const thumbnail = mediaUrl(project.thumbnail?.url);

  return (
    <article className="mx-auto max-w-3xl">
      {/* Reports the entity, so the dashboard can rank which projects are actually read. */}
      <TrackPageView path={`/projects/${project.slug}`} entityType="PROJECT" entityId={project.id} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareSourceCode",
            name: project.title,
            description: project.shortDescription,
            codeRepository: project.githubUrl || undefined,
            url: project.liveUrl || undefined,
          }),
        }}
      />

      <header className="mb-8">
        <h1 className="font-display text-4xl font-semibold tracking-tight">{project.title}</h1>
        <p className="mt-3 text-lg text-muted">{project.shortDescription}</p>
        <div className="mt-4">
          <DateRange start={project.startDate} end={project.endDate} />
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          {project.githubUrl ? (
            <ButtonLink href={project.githubUrl} external variant="ghost">
              Source
            </ButtonLink>
          ) : null}
          {project.liveUrl ? (
            <ButtonLink href={project.liveUrl} external>
              Live site
            </ButtonLink>
          ) : null}
        </div>
      </header>

      {thumbnail ? (
        <Image
          src={thumbnail}
          alt={project.thumbnail?.altText || project.title || ""}
          width={960}
          height={480}
          unoptimized
          priority
          className="mb-10 w-full rounded-2xl border border-border object-cover"
        />
      ) : null}

      {project.technologies?.length ? (
        <div className="mb-10 flex flex-wrap gap-2">
          {project.technologies.map((tech) => (
            <Chip key={tech}>{tech}</Chip>
          ))}
        </div>
      ) : null}

      {project.detailedDescription ? (
        <section className="mb-10">
          <h2 className="font-display text-2xl font-semibold">Overview</h2>
          <p className="mt-3 whitespace-pre-line text-muted">{project.detailedDescription}</p>
        </section>
      ) : null}

      {project.features ? (
        <section className="mb-10">
          <h2 className="font-display text-2xl font-semibold">Features</h2>
          <p className="mt-3 whitespace-pre-line text-muted">{project.features}</p>
        </section>
      ) : null}

      {project.challenges?.length ? (
        <section className="mb-10">
          <h2 className="font-display text-2xl font-semibold">Challenges &amp; Solutions</h2>
          <div className="mt-5 flex flex-col gap-5">
            {project.challenges.map((block) => (
              <div key={block.id} className="rounded-2xl border border-border bg-surface p-6">
                <h3 className="font-display text-lg font-semibold">{block.title}</h3>
                <p className="mt-3 text-sm">
                  <span className="font-medium text-warning">Challenge: </span>
                  <span className="text-muted">{block.challenge}</span>
                </p>
                <p className="mt-2 text-sm">
                  <span className="font-medium text-success">Solution: </span>
                  <span className="text-muted">{block.solution}</span>
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {project.gallery?.length ? (
        <section>
          <h2 className="font-display text-2xl font-semibold">Gallery</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {project.gallery.map((item) => (
              <Image
                key={item.id}
                src={mediaUrl(item.url) ?? ""}
                alt={item.altText || `${project.title} screenshot`}
                width={640}
                height={400}
                unoptimized
                className="w-full rounded-xl border border-border object-cover"
              />
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}
