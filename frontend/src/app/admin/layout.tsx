import type { Metadata } from "next";
import { AppFrame } from "@/components/admin/layout/app-frame";
import { AuthProvider } from "@/lib/admin/auth-context";
import { QueryProvider } from "@/lib/admin/query-client";

/**
 * The admin half of the merged app.
 *
 * <p>Everything admin-only lives under this segment, so Next code-splits it: a visitor loading the
 * public site never downloads the admin chunks. That was the concern D-012 raised when it kept the
 * two apps separate, and it is what makes merging them safe (D-029).
 */
export const metadata: Metadata = {
  title: "Portfolio Admin",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>
        <AppFrame>{children}</AppFrame>
      </AuthProvider>
    </QueryProvider>
  );
}
