"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiError } from "@/lib/admin/api";
import { Button, Card, ErrorState, ListSkeleton, Toast } from "@/components/admin/ui/primitives";
import { useToast } from "@/lib/admin/use-toast";

type Link = { platform: string; url: string; visible: boolean };

/** Whole-list replace, matching the API: order here is the order the public site renders. */
export function SocialLinksEditor() {
  const client = useQueryClient();
  const { message: toast, show } = useToast();
  const [links, setLinks] = useState<Link[]>([]);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["social-links"],
    queryFn: async () => {
      const { data, response } = await api.GET("/api/v1/admin/settings/social-links", {});
      if (!response.ok) throw new Error("Could not load social links.");
      return (data?.data ?? []).map((link) => ({
        platform: link.platform ?? "",
        url: link.url ?? "",
        visible: link.visible ?? true,
      }));
    },
  });

  useEffect(() => {
    if (query.data) setLinks(query.data);
  }, [query.data]);

  const save = useMutation({
    mutationFn: async () => {
      const result = await api.PUT("/api/v1/admin/settings/social-links", { body: { links } });
      if (!result.response.ok) throw new Error(apiError(result.error, "Could not save social links."));
    },
    onSuccess: () => {
      setError(null);
      client.invalidateQueries({ queryKey: ["social-links"] });
      show("Social links saved");
    },
    onError: (failure: Error) => setError(failure.message),
  });

  if (query.isLoading) return <ListSkeleton rows={3} />;
  if (query.error)
    return <ErrorState message="Could not load social links." onRetry={() => query.refetch()} />;

  const update = (index: number, patch: Partial<Link>) =>
    setLinks(links.map((link, position) => (position === index ? { ...link, ...patch } : link)));

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= links.length) return;
    const next = [...links];
    [next[index], next[target]] = [next[target], next[index]];
    setLinks(next);
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <h2 className="mb-4 font-display text-xl font-semibold">Social links</h2>
      <Card>
        <div className="flex flex-col gap-4">
          {links.length === 0 ? (
            <p className="text-sm text-muted">No links yet.</p>
          ) : (
            links.map((link, index) => (
              <div key={index} className="flex flex-wrap items-end gap-2 border-b border-border pb-4 last:border-0 last:pb-0">
                <label className="flex flex-1 flex-col gap-1">
                  <span className="text-xs text-muted">Platform</span>
                  <input
                    value={link.platform}
                    onChange={(event) => update(index, { platform: event.target.value })}
                    className="rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                </label>
                <label className="flex flex-[2] flex-col gap-1">
                  <span className="text-xs text-muted">URL</span>
                  <input
                    value={link.url}
                    onChange={(event) => update(index, { url: event.target.value })}
                    className="rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                </label>
                <label className="flex items-center gap-2 pb-2 text-sm">
                  <input
                    type="checkbox"
                    checked={link.visible}
                    onChange={(event) => update(index, { visible: event.target.checked })}
                  />
                  Visible
                </label>
                <div className="flex gap-1 pb-1">
                  <Button type="button" variant="ghost" className="px-2 py-1 text-xs" onClick={() => move(index, -1)} aria-label="Move up">
                    ↑
                  </Button>
                  <Button type="button" variant="ghost" className="px-2 py-1 text-xs" onClick={() => move(index, 1)} aria-label="Move down">
                    ↓
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    className="px-2 py-1 text-xs"
                    onClick={() => setLinks(links.filter((_, position) => position !== index))}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))
          )}

          {error ? (
            <p role="alert" className="text-sm text-warning">
              {error}
            </p>
          ) : null}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setLinks([...links, { platform: "", url: "", visible: true }])}
            >
              Add link
            </Button>
            <Button type="button" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save links"}
            </Button>
          </div>
        </div>
      </Card>
      <Toast message={toast} />
    </div>
  );
}
