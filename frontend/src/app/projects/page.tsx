import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { mediaUrl } from "@/lib/api";
import { getProjects } from "@/lib/content";
import { Card, Chip, EmptyState, PageHeader } from "@/components/ui/primitives";
import { Suspense } from "react";
import { SearchBox } from "@/components/search-box";
import { TrackPageView } from "@/components/track-page-view";

/** Rendered per request so an admin edit is visible immediately (D-025). */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Projects",
  description: "Selected work and side projects.",
  alternates: { canonical: "/projects" },
};

type Props = { searchParams: Promise<{ search?: string }> };

export default async function ProjectsPage({ searchParams }: Props) {
  const { search } = await searchParams;
  const projects = await getProjects(search);

  return (
    <>
      <TrackPageView path="/projects" />
      <div className="mx-auto max-w-4xl">
      <PageHeader title="Projects" lead="Things I have designed, built and shipped." />
      <Suspense fallback={null}>
        <SearchBox action="/projects" placeholder="Search projects and technologies" />
      </Suspense>
      {projects.length === 0 ? (
        <EmptyState message={search ? `No projects match “${search}”.` : "Nothing published yet."} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {projects.map((project) => {
            const thumbnail = mediaUrl(project.thumbnail?.url);
            return (
              <Card key={project.id}>
                {thumbnail ? (
                  <Image
                    src={thumbnail}
                    alt={project.thumbnail?.altText || project.title || ""}
                    width={640}
                    height={320}
                    unoptimized
                    className="mb-4 h-40 w-full rounded-xl border border-border object-cover"
                  />
                ) : null}
                <h2 className="font-display text-lg font-semibold">
                  <Link href={`/projects/${project.slug}`} className="hover:text-accent">
                    {project.title}
                  </Link>
                </h2>
                <p className="mt-2 text-sm text-muted">{project.shortDescription}</p>
                {project.technologies?.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {project.technologies.map((tech) => (
                      <Chip key={tech}>{tech}</Chip>
                    ))}
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
    </>
  );
}
