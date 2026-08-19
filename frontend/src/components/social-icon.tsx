import type { ReactNode } from "react";

/**
 * Brand marks for the social links.
 *
 * <p>Social links are admin-editable free text, so the icon is chosen by matching the platform
 * name rather than by an enum the admin would have to know about — "LinkedIn", "linkedin" and
 * "LinkedIn Profile" all resolve to the same mark. Anything unrecognised falls back to a generic
 * link glyph, so a platform nobody anticipated still renders as an icon instead of vanishing.
 */
const PATHS: Record<string, ReactNode> = {
  linkedin: (
    <>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </>
  ),
  github: (
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
  ),
  instagram: (
    <>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </>
  ),
  // ResearchGate has no widely-recognised outline glyph; its "R|G" mark reads clearly at this size.
  researchgate: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M9 16V8h2.2a2.2 2.2 0 0 1 0 4.4H9m2.4 0L14 16" />
      <path d="M17 10.5a1.6 1.6 0 0 0-3 .8v1.4a1.6 1.6 0 0 0 3 .8V12h-1.3" />
    </>
  ),
  twitter: (
    <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z" />
  ),
  x: (
    <>
      <path d="M4 4l16 16" />
      <path d="M20 4L4 20" />
    </>
  ),
  facebook: (
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  ),
  youtube: (
    <>
      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
      <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
    </>
  ),
  medium: (
    <>
      <circle cx="7" cy="12" r="5" />
      <ellipse cx="16.5" cy="12" rx="2.2" ry="5" />
      <ellipse cx="21.5" cy="12" rx="0.9" ry="5" />
    </>
  ),
  dribbble: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M8.56 2.75c4.37 6 6 9.42 8 17.72M3.4 8.5c6.4 1.4 12.4 1.5 18.2-.6M4.5 19.2c4.3-5.3 9.6-7.4 16-6.6" />
    </>
  ),
  email: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M2 7l10 6 10-6" />
    </>
  ),
  stackoverflow: (
    <>
      <path d="M6 18h12" />
      <path d="M7.5 14.5l9 1.2M8.5 10.8l8.6 2.8M10.4 7.4l7.8 4.4M13.2 4.6l6.2 6" />
    </>
  ),
  leetcode: (
    <>
      <path d="M13.5 3L6 11l7.5 8" />
      <path d="M10 11h9" />
    </>
  ),
  default: (
    <>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </>
  ),
};

/** Longest key first, so "stackoverflow" is not matched by a shorter key that appears inside it. */
const KEYS = Object.keys(PATHS)
  .filter((key) => key !== "default")
  .sort((a, b) => b.length - a.length);

export function socialIconKey(platform: string | undefined): string {
  const normalized = (platform ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (normalized.includes("mail")) return "email";
  return KEYS.find((key) => normalized.includes(key)) ?? "default";
}

export function SocialIcon({ platform, size = 18 }: { platform?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[socialIconKey(platform)]}
    </svg>
  );
}
