"use client";

import { useEffect, useRef } from "react";
import { browserApiBaseUrl } from "@/lib/api";

/**
 * Records one anonymous page view (FR-17).
 *
 * <p>Rendered explicitly by each page rather than once in the layout, so a page that represents a
 * specific entity can say so — and so nothing is ever counted twice by a layout-level tracker
 * firing alongside a page-level one.
 *
 * <p>Failures are swallowed: analytics must never degrade the page a visitor came for. The
 * referrer is read from the browser rather than trusted from anywhere else, and no identifier of
 * any kind is sent — the server derives device and browser from the User-Agent it already has.
 */
export function TrackPageView({
  path,
  entityType,
  entityId,
}: {
  path: string;
  entityType?: string;
  entityId?: number;
}) {
  const recorded = useRef<string | null>(null);

  useEffect(() => {
    // React 18+ mounts effects twice in development; the guard keeps one visit as one view.
    const key = `${path}:${entityType ?? ""}:${entityId ?? ""}`;
    if (recorded.current === key) return;
    recorded.current = key;

    const controller = new AbortController();
    fetch(`${browserApiBaseUrl}/api/v1/analytics/page-view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      keepalive: true,
      body: JSON.stringify({
        path,
        entityType,
        entityId,
        // Same-origin navigations are not interesting as "referrers"; only external ones are.
        referrer:
          document.referrer && !document.referrer.startsWith(window.location.origin)
            ? document.referrer.slice(0, 500)
            : undefined,
      }),
    }).catch(() => {
      /* Analytics is best-effort by design. */
    });

    return () => controller.abort();
  }, [path, entityType, entityId]);

  return null;
}
