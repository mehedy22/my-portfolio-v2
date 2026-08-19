import type { Metadata } from "next";
import Image from "next/image";
import { mediaUrl } from "@/lib/api";
import { getCertifications } from "@/lib/content";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { TrackPageView } from "@/components/track-page-view";

/** Rendered per request so an admin edit is visible immediately (D-025). */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Certifications",
  description: "Credentials and certifications.",
  alternates: { canonical: "/certifications" },
};

export default async function CertificationsPage() {
  const certifications = await getCertifications();

  return (
    <>
      <TrackPageView path="/certifications" />
      <div className="mx-auto max-w-3xl">
      <PageHeader title="Certifications" />
      {certifications.length === 0 ? (
        <EmptyState message="Nothing published yet." />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {certifications.map((certification) => {
            const image = mediaUrl(certification.certificateImage?.url);
            return (
              <Card key={certification.id}>
                {image ? (
                  <Image
                    src={image}
                    alt={certification.certificateImage?.altText || certification.name || ""}
                    width={480}
                    height={280}
                    unoptimized
                    className="mb-4 h-36 w-full rounded-xl border border-border object-cover"
                  />
                ) : null}
                <h2 className="font-display text-lg font-semibold">{certification.name}</h2>
                <p className="text-sm text-accent">{certification.issuer}</p>
                {certification.issueDate ? (
                  <p className="mt-1 text-sm text-muted">
                    Issued{" "}
                    {new Date(certification.issueDate).toLocaleDateString("en-GB", {
                      month: "short",
                      year: "numeric",
                    })}
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
            );
          })}
        </div>
      )}
    </div>
    </>
  );
}
