"use client";

import { usePathname } from "next/navigation";
import { AdminShell } from "@/components/admin/layout/admin-shell";

/**
 * Mounts the authenticated shell — sidebar, topbar and the auth guard — around every route
 * except the handful an anonymous visitor must be able to reach (sign-in and password reset).
 *
 * <p>Done here rather than with a route group so the guard is applied by construction: a new
 * screen added under {@code app/} is protected because it exists, not because someone remembered
 * to put it in the right folder.
 */
/** The only screens an anonymous visitor may see. Everything else is behind the shell's guard. */
const PUBLIC_ROUTES = new Set(["/admin/login", "/admin/forgot-password", "/admin/reset-password"]);

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (PUBLIC_ROUTES.has(pathname)) return <>{children}</>;
  return <AdminShell>{children}</AdminShell>;
}
