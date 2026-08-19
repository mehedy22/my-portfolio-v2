"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** No dashboard at MVP (SHOULD-tier in Phase 10) — land on the first real screen instead. */
export default function AdminHome() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/projects");
  }, [router]);
  return null;
}
