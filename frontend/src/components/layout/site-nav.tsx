"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export type NavItem = { href: string; label: string };

/**
 * The vertical sidebar nav from the published mockup. Client-side only because it tracks the
 * active route and the mobile drawer; the sidebar's *content* is decided on the server from
 * Settings, so nav toggles still work without shipping the settings fetch to the browser.
 */
export function SiteNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      <button
        type="button"
        className="mb-4 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm md:hidden"
        aria-expanded={open}
        aria-controls="site-nav"
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden>☰</span> Menu
      </button>

      <nav
        id="site-nav"
        aria-label="Main"
        className={`${open ? "block" : "hidden"} md:block`}
      >
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive(item.href)
                    ? "bg-accent-soft text-accent"
                    : "text-muted hover:bg-accent-soft hover:text-accent"
                }`}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
