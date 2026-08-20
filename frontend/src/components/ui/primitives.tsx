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

/**
 * The employer's name, linked to their site when one is set.
 *
 * <p>A role names a company, and a reader who does not recognise the name has nowhere to go. The
 * link is the name itself rather than a separate icon — there is nothing else on the card it could
 * be mistaken for — and it opens in a new tab, because losing a half-read CV to a company homepage
 * is a poor trade.
 */
export function CompanyName({ name, url }: { name?: string; url?: string }) {
  if (!name) return null;
  if (!url) return <span>{name}</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex items-center gap-1 hover:underline"
    >
      {name}
      <span aria-hidden className="text-[0.7em] opacity-70">
        &#8599;
      </span>
      <span className="sr-only">(opens the company website in a new tab)</span>
    </a>
  );
}

/**
 * Formats a date range as "February 2025 — November 2025".
 *
 * <p>The month is spelled out, and it is always there: a year-only range collapsed most entries
 * to "2025 — 2025", which tells the reader nothing about how long anything lasted.
 *
 * <p>Parsed from the string's own parts, not by `new Date()`. The API sends plain `YYYY-MM-DD`
 * dates and JavaScript reads those as UTC midnight, so in any timezone behind Greenwich a 1 March
 * start renders as February — the same class of bug that made the Node backend look a day early.
 */
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
  const format = (value?: string) => {
    if (!value) return undefined;
    const parts = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    const date = parts
      ? new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]))
      : new Date(value);
    if (Number.isNaN(date.getTime())) return undefined;
    return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  };
  const to = current ? currentLabel : format(end);
  return (
    <span className="text-sm text-muted">
      {[format(start), to].filter(Boolean).join(" — ")}
    </span>
  );
}
