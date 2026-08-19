"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/admin/auth-context";
import { Button } from "@/components/admin/ui/primitives";

/** Sidebar groups mirror docs/10-frontend/routes-and-layouts.md's Admin layout. */
const NAV_GROUPS: { group: string; items: { href: string; label: string }[] }[] = [
  { group: "Portfolio", items: [
    { href: "/admin/projects", label: "Projects" },
    { href: "/admin/experience", label: "Experience" },
    { href: "/admin/skills", label: "Skills" },
    { href: "/admin/problem-solving", label: "Problem solving" },
    { href: "/admin/education", label: "Education" },
    { href: "/admin/certifications", label: "Certifications" },
    { href: "/admin/achievements", label: "Achievements" },
  ] },
  { group: "Writing", items: [
    { href: "/admin/articles", label: "Articles" },
    { href: "/admin/research", label: "Research" },
  ] },
  { group: "Media", items: [{ href: "/admin/media", label: "Media library" }] },
  { group: "Communication", items: [{ href: "/admin/contact-messages", label: "Messages" }] },
  { group: "Analytics", items: [{ href: "/admin/analytics", label: "Dashboard" }] },
  { group: "Settings", items: [
    { href: "/admin/settings", label: "General" },
    { href: "/admin/settings/seo", label: "SEO" },
    { href: "/admin/settings/profile", label: "Profile & resume" },
  ] },
];

/**
 * The auth guard for every route except /login: no in-memory token → the provider has already
 * attempted one silent refresh → still nothing means redirect (Phase 11).
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const { status, admin, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (status === "anonymous") router.replace("/admin/login");
  }, [status, router]);

  if (status !== "authenticated") {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted">
        {status === "loading" ? "Restoring your session…" : "Redirecting to sign in…"}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <button
        type="button"
        className="m-4 self-start rounded-lg border border-border px-3 py-2 text-sm lg:hidden"
        aria-expanded={drawerOpen}
        aria-controls="admin-nav"
        onClick={() => setDrawerOpen((open) => !open)}
      >
        ☰ Menu
      </button>

      <aside
        id="admin-nav"
        className={`${drawerOpen ? "block" : "hidden"} w-full shrink-0 border-b border-border bg-surface p-5 lg:block lg:h-screen lg:w-64 lg:border-b-0 lg:border-r lg:sticky lg:top-0 lg:overflow-y-auto`}
      >
        <Link href="/" className="font-display text-lg font-semibold">
          Admin
        </Link>
        <nav aria-label="Admin sections" className="mt-6 flex flex-col gap-6">
          {NAV_GROUPS.map(({ group, items }) => (
            <div key={group}>
              <p className="px-3 text-xs font-semibold uppercase tracking-wide text-muted">{group}</p>
              <ul className="mt-2 flex flex-col gap-1">
                {items.map((item) => {
                  const active =
                    pathname === item.href ||
                    (item.href !== "/settings" && pathname.startsWith(`${item.href}/`)) ||
                    (item.href === "/settings" && pathname === "/admin/settings");
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        onClick={() => setDrawerOpen(false)}
                        className={`block rounded-lg px-3 py-2 text-sm transition ${
                          active
                            ? "bg-accent-soft font-medium text-accent"
                            : "text-muted hover:bg-accent-soft hover:text-accent"
                        }`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-border bg-surface px-6 py-3">
          <span className="truncate text-sm text-muted">{admin?.email}</span>
          <Button variant="ghost" onClick={signOut}>
            Sign out
          </Button>
        </header>
        <main className="flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
