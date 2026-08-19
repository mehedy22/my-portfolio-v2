import Link from "next/link";
import type { ReactNode } from "react";

/** Section heading used across every public page. */
export function PageHeader({ title, lead }: { title: string; lead?: string }) {
  return (
    <header className="mb-10">
      <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
      {lead ? <p className="mt-3 max-w-2xl text-lg text-muted">{lead}</p> : null}
    </header>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-border bg-surface p-6 transition-shadow hover:shadow-[0_2px_20px_-8px_var(--color-accent)] ${className}`}
    >
      {children}
    </div>
  );
}

export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-border bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
      {children}
    </span>
  );
}

/**
 * Empty state. The copy differs from the Admin Panel's on purpose: a visitor is told there is
 * nothing to see, not invited to create something
 * (docs/10-frontend/ux-states-and-quality.md).
 */
export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted">
      {message}
    </div>
  );
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
  external = false,
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "ghost";
  external?: boolean;
}) {
  const styles =
    variant === "primary"
      ? "bg-accent text-white hover:opacity-90"
      : "border border-border text-text hover:border-accent hover:text-accent";
  const className = `inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition ${styles}`;

  if (external) {
    return (
      <a href={href} className={className} target="_blank" rel="noreferrer noopener">
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

/** Formats a date range as the mockup shows it: "Apr 2021 — Present". */
export function DateRange({
  start,
  end,
  current,
  currentLabel = "Present",
}: {
  start?: string;
  end?: string;
  current?: boolean;
  currentLabel?: string;
}) {
  if (!start && !end) return null;
  const format = (value?: string) =>
    value
      ? new Date(value).toLocaleDateString("en-GB", { month: "short", year: "numeric" })
      : undefined;
  const to = current ? currentLabel : format(end);
  return (
    <span className="text-sm text-muted">
      {[format(start), to].filter(Boolean).join(" — ")}
    </span>
  );
}
