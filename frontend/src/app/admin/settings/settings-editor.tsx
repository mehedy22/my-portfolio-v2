"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiError } from "@/lib/admin/api";
import { Button, Card, ErrorState, ListSkeleton, PageHeader, Toast } from "@/components/admin/ui/primitives";
import { useToast } from "@/lib/admin/use-toast";

const BOOLEAN_KEYS = new Set(["nav.show_articles", "nav.show_research"]);
const MULTILINE_KEYS = new Set(["site.description", "seo.default_description"]);

/** Human labels for the registry's dotted keys; unknown keys fall back to the key itself. */
const LABELS: Record<string, string> = {
  "site.title": "Site title",
  "site.tagline": "Tagline",
  "site.description": "Description",
  "site.footer_text": "Footer text",
  "site.copyright": "Copyright",
  "contact.notification_email": "Notification email (private)",
  "nav.show_articles": "Show Articles in the nav",
  "nav.show_research": "Show Research in the nav",
  "seo.default_title": "Default page title",
  "seo.default_description": "Default meta description",
  "seo.default_og_image_url": "Default Open Graph image URL",
};

/**
 * Drives both the General and SEO screens. The server owns the catalogue (D-024), so this renders
 * whatever keys come back rather than hardcoding a form — a new setting appears here on its own.
 */
export function SettingsEditor({ title, path }: { title: string; path: string }) {
  const client = useQueryClient();
  const { message: toast, show } = useToast();
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["settings", path],
    queryFn: async () => {
      const { data, response } = await api.GET(path as never, {} as never);
      if (!response.ok) throw new Error("Could not load settings.");
      const envelope = data as unknown as { data?: { settings?: Record<string, string> } } | undefined;
      return (envelope?.data?.settings ?? {}) as Record<string, string>;
    },
  });

  useEffect(() => {
    if (query.data) setValues(query.data);
  }, [query.data]);

  const save = useMutation({
    mutationFn: async () => {
      const result = await api.PUT(path as never, { body: { settings: values } } as never);
      if (!result.response.ok) throw new Error(apiError(result.error, "Could not save settings."));
    },
    onSuccess: () => {
      setError(null);
      client.invalidateQueries({ queryKey: ["settings", path] });
      show("Settings saved — the public site picks this up on its next request");
    },
    onError: (failure: Error) => setError(failure.message),
  });

  if (query.isLoading) return <ListSkeleton rows={5} />;
  if (query.error)
    return <ErrorState message="Could not load settings." onRetry={() => query.refetch()} />;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={title} />
      <Card>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
          className="flex flex-col gap-4"
        >
          {Object.keys(values)
            .sort()
            .map((key) => (
              <label key={key} className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">{LABELS[key] ?? key}</span>
                {BOOLEAN_KEYS.has(key) ? (
                  <select
                    value={values[key]}
                    onChange={(event) => setValues({ ...values, [key]: event.target.value })}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
                  >
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </select>
                ) : MULTILINE_KEYS.has(key) ? (
                  <textarea
                    rows={3}
                    value={values[key]}
                    onChange={(event) => setValues({ ...values, [key]: event.target.value })}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                ) : (
                  <input
                    value={values[key]}
                    onChange={(event) => setValues({ ...values, [key]: event.target.value })}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                )}
                <span className="text-xs text-muted">{key}</span>
              </label>
            ))}

          {error ? (
            <p role="alert" className="text-sm text-warning">
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={save.isPending} className="mt-2 self-start">
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </Card>
      <Toast message={toast} />
    </div>
  );
}
