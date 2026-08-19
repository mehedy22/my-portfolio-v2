import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { mediaUrl } from "@/lib/api";
import { getArticles } from "@/lib/content";
import { Suspense } from "react";
import { SearchBox } from "@/components/search-box";
import { TrackPageView } from "@/components/track-page-view";
import { Chip, EmptyState, PageHeader } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Articles",
  description: "Writing on engineering, architecture and the things I build.",
  alternates: { canonical: "/articles" },
};

type Props = { searchParams: Promise<{ category?: string; tag?: string; page?: string; search?: string }> };

export default async function ArticlesPage({ searchParams }: Props) {
  const { category, tag, page, search } = await searchParams;
  const articles = await getArticles({ category, tag, search, page: page ? Number(page) - 1 : 0 });
  const filtered = Boolean(category || tag);

  return (
    <div className="mx-auto max-w-3xl">
      <TrackPageView path="/articles" />
      <PageHeader title="Articles" lead="Writing on engineering, architecture and the things I build." />
      <Suspense fallback={null}>
        <SearchBox action="/articles" placeholder="Search articles" />
      </Suspense>

      {filtered ? (
        <p className="mb-6 text-sm text-muted">
          Filtered by {category ? `category “${category}”` : `tag “${tag}”`} ·{" "}
          <Link href="/articles" className="text-accent hover:underline">
            clear
          </Link>
        </p>
      ) : null}

      {articles.content?.length === 0 ? (
        <EmptyState message={filtered ? "Nothing published under that filter yet." : "Nothing published yet."} />
      ) : (
        /* The mockup's row layout: a small thumbnail, then tag, date and reading time, then the
           title and excerpt — separated by rules rather than boxed in cards. */
        <div className="flex flex-col">
          {articles.content?.map((article, index) => {
            const thumbnail = mediaUrl(article.thumbnail?.url);
            return (
              <article
                key={article.id}
                className={`flex gap-5 py-6 ${index < (articles.content?.length ?? 0) - 1 ? "border-b border-border" : ""}`}
              >
                <div className="relative hidden h-20 w-30 shrink-0 overflow-hidden rounded-xl border border-border bg-accent-soft sm:block">
                  {thumbnail ? (
                    <Image
                      src={thumbnail}
                      alt={article.thumbnail?.altText || article.title || ""}
                      fill
                      unoptimized
                      sizes="120px"
                      className="object-cover"
                    />
                  ) : null}
                </div>

                <div className="min-w-0">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    {article.category ? (
                      <Link href={`/articles?category=${encodeURIComponent(article.category.toLowerCase())}`}>
                        <Chip>{article.category}</Chip>
                      </Link>
                    ) : null}
                    <span className="text-xs text-muted">
                      {article.publishedAt
                        ? new Date(article.publishedAt).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : null}
                      {article.readingTimeMinutes ? ` · ${article.readingTimeMinutes} min read` : ""}
                    </span>
                  </div>

                  <h2 className="font-display text-lg font-semibold">
                    <Link href={`/articles/${article.slug}`} className="hover:text-accent">
                      {article.title}
                    </Link>
                  </h2>

                  {article.excerpt ? (
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">{article.excerpt}</p>
                  ) : null}

                  {article.tags?.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {article.tags.map((name) => (
                        <Link key={name} href={`/articles?tag=${encodeURIComponent(name.toLowerCase())}`}>
                          <Chip>#{name}</Chip>
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {(articles.totalPages ?? 0) > 1 ? (
        <nav aria-label="Pagination" className="mt-8 flex justify-center gap-3 text-sm">
          {Array.from({ length: articles.totalPages ?? 0 }).map((_, index) => (
            <Link
              key={index}
              href={`/articles?page=${index + 1}`}
              aria-current={(articles.page ?? 0) === index ? "page" : undefined}
              className={`rounded-lg border border-border px-3 py-1.5 ${
                (articles.page ?? 0) === index ? "bg-accent-soft text-accent" : "text-muted hover:text-accent"
              }`}
            >
              {index + 1}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
