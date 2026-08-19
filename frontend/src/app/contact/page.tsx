import type { Metadata } from "next";
import { ContactForm } from "@/components/contact-form";
import { getSettings } from "@/lib/content";
import { PageHeader } from "@/components/ui/primitives";
import { TrackPageView } from "@/components/track-page-view";

/** Rendered per request so an admin edit is visible immediately (D-025). */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Contact", description: "Get in touch.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  const settings = await getSettings();

  return (
    <>
      <TrackPageView path="/contact" />
      <div className="mx-auto max-w-2xl">
      <PageHeader title="Contact" lead="Send a message and I will get back to you." />
      {/* Server-rendered shell, one interactive client leaf — the pattern Phase 11 fixed. */}
      <ContactForm />

      {settings.socialLinks?.length ? (
        <p className="mt-10 text-sm text-muted">
          You can also find me on{" "}
          {settings.socialLinks.map((link, index) => (
            <span key={link.id}>
              {index > 0 ? ", " : ""}
              <a
                href={link.url}
                target="_blank"
                rel="noreferrer noopener me"
                className="text-accent hover:underline"
              >
                {link.platform}
              </a>
            </span>
          ))}
          .
        </p>
      ) : null}
    </div>
    </>
  );
}
