import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { mediaUrl } from "@/lib/api";
import { getArticle } from "@/lib/content";
import { TrackPageView } from "@/components/track-page-view";
import { Chip } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return { title: "Not found" };
  const image = mediaUrl(article.ogImage?.url) ?? mediaUrl(article.thumbnail?.url);
  const description = article.seoDescription || article.excerpt || undefined;
  return {
    title: article.seoTitle || article.title,
    description,
    alternates: { canonical: `/articles/${article.slug}` },
    openGraph: {
      title: article.seoTitle || article.title,
      description,
      type: "article",
      publishedTime: article.publishedAt,
      images: image ? [image] : undefined,
    },
  };
}

export default async function ArticleDetailPage({ params }: Props) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();

  const thumbnail = mediaUrl(article.thumbnail?.url);

  return (
    <article className="mx-auto max-w-2xl">
      <TrackPageView path={`/articles/${article.slug}`} entityType="ARTICLE" entityId={article.id} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: article.title,
            description: article.seoDescription || article.excerpt || undefined,
            datePublished: article.publishedAt,
            dateModified: article.updatedAt,
          }),
        }}
      />

      <header className="mb-8">
        <h1 className="font-display text-4xl font-semibold tracking-tight">{article.title}</h1>
        <p className="mt-3 text-sm text-muted">
          {article.publishedAt
            ? new Date(article.publishedAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })
            : null}
          {article.readingTimeMinutes ? ` · ${article.readingTimeMinutes} min read` : ""}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {article.category ? (
            <Link href={`/articles?category=${encodeURIComponent(article.category.toLowerCase())}`}>
              <Chip>{article.category}</Chip>
            </Link>
          ) : null}
          {article.tags?.map((name) => (
            <Link key={name} href={`/articles?tag=${encodeURIComponent(name.toLowerCase())}`}>
              <Chip>#{name}</Chip>
            </Link>
          ))}
        </div>
      </header>

      {thumbnail ? (
        <Image
          src={thumbnail}
          alt={article.thumbnail?.altText || article.title || ""}
          width={960}
          height={480}
          unoptimized
          priority
          className="mb-10 w-full rounded-2xl border border-border object-cover"
        />
      ) : null}

      {/*
        The single sanctioned use of dangerouslySetInnerHTML in this codebase (D-027): the article
        body is the one rich-text field, and it is sanitized against an allow-list on write, so
        what is stored is already safe. Nothing else — no project description, no contact
        message — may be rendered this way.
      */}
      <div
        className="prose-article flex flex-col gap-4 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: article.content ?? "" }}
      />
    </article>
  );
}
