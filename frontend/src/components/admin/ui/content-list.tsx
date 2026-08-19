"use client";

import type { ReactNode } from "react";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  StatusBadge,
} from "@/components/admin/ui/primitives";

export type ContentRow = {
  id?: number;
  title: string;
  subtitle?: string;
  status?: string;
};

/**
 * The list half of every simple content screen: loading skeleton, error with retry, empty state
 * with a call to action, and rows with edit/delete. Written once because Experience, Skills,
 * Education and Certifications differ only in their fields, not in how a list behaves.
 */
export function ContentList({
  isLoading,
  error,
  rows,
  emptyMessage,
  onRetry,
  onEdit,
  onDelete,
  action,
  extra,
}: {
  isLoading: boolean;
  error: unknown;
  rows: ContentRow[];
  emptyMessage: string;
  onRetry: () => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  action?: ReactNode;
  extra?: (row: ContentRow) => ReactNode;
}) {
  if (isLoading) return <ListSkeleton />;
  if (error)
    return (
      <ErrorState
        message={error instanceof Error ? error.message : "Could not load this list."}
        onRetry={onRetry}
      />
    );
  if (rows.length === 0) return <EmptyState message={emptyMessage} action={action} />;

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.id}>
          <Card className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{row.title}</p>
              {row.subtitle ? <p className="truncate text-sm text-muted">{row.subtitle}</p> : null}
            </div>
            <div className="flex items-center gap-2">
              {extra?.(row)}
              {row.status ? <StatusBadge status={row.status} /> : null}
              <Button variant="ghost" onClick={() => row.id && onEdit(row.id)}>
                Edit
              </Button>
              <Button variant="danger" onClick={() => row.id && onDelete(row.id)}>
                Delete
              </Button>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
