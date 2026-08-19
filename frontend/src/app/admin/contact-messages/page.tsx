"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/admin/api";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  PageHeader,
  Toast,
} from "@/components/admin/ui/primitives";
import { useToast } from "@/lib/admin/use-toast";

const STATUSES = ["NEW", "READ", "REPLIED"] as const;
type Status = (typeof STATUSES)[number];

export default function ContactMessagesPage() {
  const client = useQueryClient();
  const { message: toast, show } = useToast();
  const [filter, setFilter] = useState<Status | "">("");
  const [expanded, setExpanded] = useState<number | null>(null);

  const list = useQuery({
    queryKey: ["contact-messages", filter],
    queryFn: async () => {
      const { data, response } = await api.GET("/api/v1/admin/contact-messages", {
        params: { query: { page: 0, size: 50, ...(filter ? { status: filter } : {}) } },
      });
      if (!response.ok) throw new Error("Could not load messages.");
      return data?.data?.content ?? [];
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: Status }) => {
      const { response } = await api.PATCH("/api/v1/admin/contact-messages/{id}/status", {
        params: { path: { id } },
        body: { status },
      });
      if (!response.ok) throw new Error("Could not update the status.");
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["contact-messages"] });
      show("Status updated");
    },
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const { response } = await api.DELETE("/api/v1/admin/contact-messages/{id}", {
        params: { path: { id } },
      });
      if (!response.ok) throw new Error("Could not delete this message.");
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["contact-messages"] });
      show("Message deleted");
    },
  });

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Messages"
        action={
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted">Status</span>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as Status | "")}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm"
            >
              <option value="">All</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status.toLowerCase()}
                </option>
              ))}
            </select>
          </label>
        }
      />

      {list.isLoading ? (
        <ListSkeleton />
      ) : list.error ? (
        <ErrorState message="Could not load messages." onRetry={() => list.refetch()} />
      ) : (list.data ?? []).length === 0 ? (
        <EmptyState message="No messages yet." />
      ) : (
        <ul className="flex flex-col gap-3">
          {(list.data ?? []).map((item) => (
            <li key={item.id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {item.name}{" "}
                      <a href={`mailto:${item.email}`} className="text-sm text-accent hover:underline">
                        &lt;{item.email}&gt;
                      </a>
                    </p>
                    {item.subject ? <p className="text-sm text-muted">{item.subject}</p> : null}
                    <p className="mt-1 text-xs text-muted">
                      {item.createdAt ? new Date(item.createdAt).toLocaleString("en-GB") : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={item.status}
                      onChange={(event) =>
                        item.id &&
                        setStatus.mutate({ id: item.id, status: event.target.value as Status })
                      }
                      aria-label={`Status of the message from ${item.name}`}
                      className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs"
                    >
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status.toLowerCase()}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="ghost"
                      className="px-3 py-1.5 text-xs"
                      onClick={() => setExpanded(expanded === item.id ? null : (item.id ?? null))}
                    >
                      {expanded === item.id ? "Hide" : "Read"}
                    </Button>
                    <Button
                      variant="danger"
                      className="px-3 py-1.5 text-xs"
                      onClick={() => item.id && remove.mutate(item.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
                {expanded === item.id ? (
                  // Rendered as text, never as HTML — the message is stored verbatim (D-023).
                  <p className="mt-4 whitespace-pre-line border-t border-border pt-4 text-sm">
                    {item.message}
                  </p>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Toast message={toast} />
    </div>
  );
}
