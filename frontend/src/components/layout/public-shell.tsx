"use client";

import { usePathname } from "next/navigation";

/**
 * Applies the public site's chrome — sidebar, footer — to everything except the admin segment,
 * which brings its own shell.
 *
 * <p>A client component only because it reads the pathname; the sidebar and footer it renders are
 * still Server Components, passed through as children so their data fetching stays on the server.
 */
export function PublicShell({
  sidebar,
  footer,
  children,
}: {
  sidebar: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return <>{children}</>;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {sidebar}
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 px-6 py-12 sm:px-10 lg:px-16">{children}</main>
        {footer}
      </div>
    </div>
  );
}
