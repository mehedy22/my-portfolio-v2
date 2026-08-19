"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/admin/api";
import {
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  PageHeader,
} from "@/components/admin/ui/primitives";

/**
 * The analytics dashboard.
 *
 * <p>The published mockup showed "Unique Visitors" and "Avg. Session" tiles. Neither is built,
 * and deliberately so: both require recognising a visitor across requests, and this module
 * stores nothing that can (D-026). The tiles here are the ones an anonymous log can answer
 * honestly — showing a fabricated number would be worse than showing fewer.
 */
export default function AnalyticsPage() {
  const [entityType, setEntityType] = useState("");

  const summary = useQuery({
    queryKey: ["analytics-summary"],
    queryFn: async () => {
      const { data, response } = await api.GET("/api/v1/admin/analytics/summary", {});
      if (!response.ok) throw new Error("Could not load analytics.");
      return data?.data;
    },
  });

  const log = useQuery({
    queryKey: ["analytics-log", entityType],
    queryFn: async () => {
      const { data, response } = await api.GET("/api/v1/admin/analytics/page-views", {
        params: { query: { page: 0, size: 50, ...(entityType ? { entityType } : {}) } },
      });
      if (!response.ok) throw new Error("Could not load the page-view log.");
      return data?.data?.content ?? [];
    },
  });

  if (summary.isLoading) return <ListSkeleton rows={4} />;
  if (summary.error)
    return <ErrorState message="Could not load analytics." onRetry={() => summary.refetch()} />;

  const data = summary.data;
  const daily = data?.dailyViews ?? [];
  const peak = Math.max(1, ...daily.map((point) => point.views ?? 0));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Analytics" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total views" value={data?.totalViews ?? 0} />
        <Stat label="Today" value={data?.viewsToday ?? 0} />
        <Stat label="Last 7 days" value={data?.viewsLast7Days ?? 0} />
        <Stat label="Last 30 days" value={data?.viewsLast30Days ?? 0} />
      </div>

      <Card className="mt-6">
        <h2 className="font-display text-base font-semibold">Views — last 30 days</h2>
        {daily.every((point) => (point.views ?? 0) === 0) ? (
          <p className="mt-4 text-sm text-muted">No views recorded yet.</p>
        ) : (
          <div className="mt-5 flex h-40 items-end gap-1" role="img" aria-label="Daily page views for the last 30 days">
            {daily.map((point) => (
              <div
                key={point.date}
                title={`${point.date}: ${point.views}`}
                style={{ height: `${Math.max(2, ((point.views ?? 0) / peak) * 100)}%` }}
                className="flex-1 rounded-t bg-accent/70 transition hover:bg-accent"
              />
            ))}
          </div>
        )}
      </Card>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Breakdown title="Top pages" rows={data?.topPages ?? []} empty="No page views yet." />
        <Breakdown title="Top referrers" rows={data?.topReferrers ?? []} empty="No external referrers yet." />
        <Breakdown title="By device" rows={data?.byDevice ?? []} empty="No views yet." />
        <Breakdown title="By browser" rows={data?.byBrowser ?? []} empty="No views yet." />
      </div>

      <Card className="mt-6">
        <h2 className="font-display text-base font-semibold">Most-viewed entities</h2>
        {(data?.topEntities ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nothing tracked against a specific entity yet.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2 text-sm">
            {(data?.topEntities ?? []).map((row) => (
              <li key={`${row.entityType}-${row.entityId}`} className="flex justify-between gap-4">
                <span className="text-muted">
                  {row.entityType?.toLowerCase()} #{row.entityId}
                </span>
                <span className="font-medium">{row.views}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold">Raw log</h2>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted">Entity type</span>
            <select
              value={entityType}
              onChange={(event) => setEntityType(event.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm"
            >
              <option value="">All</option>
              <option value="PROJECT">Project</option>
            </select>
          </label>
        </div>

        {log.isLoading ? (
          <ListSkeleton rows={3} />
        ) : log.error ? (
          <ErrorState message="Could not load the log." onRetry={() => log.refetch()} />
        ) : (log.data ?? []).length === 0 ? (
          <EmptyState message="No page views recorded yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2 pr-4">Path</th>
                  <th className="py-2 pr-4">Entity</th>
                  <th className="py-2 pr-4">Device</th>
                  <th className="py-2">Browser</th>
                </tr>
              </thead>
              <tbody>
                {(log.data ?? []).map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="whitespace-nowrap py-2 pr-4 text-muted">
                      {row.viewedAt ? new Date(row.viewedAt).toLocaleString("en-GB") : ""}
                    </td>
                    <td className="py-2 pr-4">{row.path}</td>
                    <td className="py-2 pr-4 text-muted">
                      {row.entityType ? `${row.entityType.toLowerCase()} #${row.entityId}` : "—"}
                    </td>
                    <td className="py-2 pr-4 text-muted">{row.deviceType?.toLowerCase()}</td>
                    <td className="py-2 text-muted">{row.browser ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 font-display text-3xl font-semibold">{value.toLocaleString("en-GB")}</p>
    </Card>
  );
}

function Breakdown({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: { label?: string; views?: number }[];
  empty: string;
}) {
  const total = rows.reduce((sum, row) => sum + (row.views ?? 0), 0) || 1;
  return (
    <Card>
      <h2 className="font-display text-base font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.label}>
              <div className="flex justify-between gap-4 text-sm">
                <span className="truncate text-muted" title={row.label}>
                  {row.label}
                </span>
                <span className="font-medium">{row.views}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-accent-soft">
                <div
                  className="h-1.5 rounded-full bg-accent"
                  style={{ width: `${((row.views ?? 0) / total) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
