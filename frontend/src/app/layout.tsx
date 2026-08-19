import type { Metadata } from "next";
import { IBM_Plex_Sans, Space_Grotesk } from "next/font/google";
import { PublicShell } from "@/components/layout/public-shell";
import { Sidebar } from "@/components/layout/sidebar";
import { SiteFooter } from "@/components/layout/site-footer";
import { getSettings, setting } from "@/lib/content";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

/**
 * Metadata comes from Settings, not from a constant — FR-11 requires the site title and
 * description to be admin-editable, and a hardcoded `<title>` would quietly break that.
 */
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const title = setting(settings, "seo.default_title") || setting(settings, "site.title", "Portfolio");
  const description =
    setting(settings, "seo.default_description") || setting(settings, "site.description");
  const ogImage = setting(settings, "seo.default_og_image_url");

  return {
    title: { default: title, template: `%s · ${title}` },
    description: description || undefined,
    openGraph: {
      title,
      description: description || undefined,
      type: "website",
      images: ogImage ? [ogImage] : undefined,
    },
    twitter: { card: "summary_large_image", title, description: description || undefined },
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${ibmPlexSans.variable} h-full antialiased`}
    >
      <head>
        {/*
          Runs before first paint: without it the page renders in the default theme and then
          snaps to the reader's choice, which is worse than not offering the choice at all.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('portfolio-theme');if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}",
          }}
        />
      </head>
      <body className="min-h-full">
        {/* The public chrome is applied by route, so /admin gets its own shell instead. */}
        <PublicShell sidebar={<Sidebar />} footer={<SiteFooter />}>
          {children}
        </PublicShell>
      </body>
    </html>
  );
}
