"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, apiError } from "@/lib/admin/api";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  ListSkeleton,
  PageHeader,
  StatusBadge,
  Toast,
  inputClass,
} from "@/components/admin/ui/primitives";
import { Modal } from "@/components/admin/ui/modal";
import { MediaPicker } from "@/components/admin/ui/media-picker";
import { useToast } from "@/lib/admin/use-toast";
import type { components } from "@/generated/api/schema";

type Article = components["schemas"]["ArticleResponse"];
const STATUSES = ["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"] as const;
type ArticleStatus = (typeof STATUSES)[number];

type FormValues = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  tags: string;
  status: ArticleStatus;
  publishedAt: string;
  seoTitle: string;
  seoDescription: string;
  thumbnailMediaId: number | null;
};

const empty = (): FormValues => ({
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  category: "",
  tags: "",
  status: "DRAFT",
  publishedAt: "",
  seoTitle: "",
  seoDescription: "",
  thumbnailMediaId: null,
});

/** `datetime-local` needs "YYYY-MM-DDTHH:mm" in local time; the API speaks UTC instants. */
function toLocalInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminArticlesPage() {
  const client = useQueryClient();
  const { message: toast, show } = useToast();
  const [filter, setFilter] = useState<ArticleStatus | "">("");
  const [editing, setEditing] = useState<{ id?: number; values: FormValues } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["articles", filter],
    queryFn: async () => {
      const { data, response } = await api.GET("/api/v1/admin/articles", {
        params: { query: { page: 0, size: 100, ...(filter ? { status: filter } : {}) } },
      });
      if (!response.ok) throw new Error("Could not load articles.");
      return data?.data?.content ?? [];
    },
  });

  async function openEdit(id: number) {
    const { data, response } = await api.GET("/api/v1/admin/articles/{id}", { params: { path: { id } } });
    if (!response.ok || !data?.data) {
      show("Could not open that article");
      return;
    }
    const a = data.data as Article;
    setFormError(null);
    setEditing({
      id,
      values: {
        title: a.title ?? "",
        slug: a.slug ?? "",
        excerpt: a.excerpt ?? "",
        content: a.content ?? "",
        category: a.category ?? "",
        tags: (a.tags ?? []).join(", "),
        status: (a.status ?? "DRAFT") as ArticleStatus,
        publishedAt: toLocalInput(a.publishedAt),
        seoTitle: a.seoTitle ?? "",
        seoDescription: a.seoDescription ?? "",
        thumbnailMediaId: a.thumbnail?.id ?? null,
      },
    });
  }

  const save = useMutation({
    mutationFn: async ({ id, values }: { id?: number; values: FormValues }) => {
      const body = {
        title: values.title,
        slug: values.slug || undefined,
        excerpt: values.excerpt || undefined,
        content: values.content,
        category: values.category || undefined,
        tags: values.tags.split(",").map((t) => t.trim()).filter(Boolean),
        status: values.status,
        publishedAt: values.publishedAt ? new Date(values.publishedAt).toISOString() : undefined,
        seoTitle: values.seoTitle || undefined,
        seoDescription: values.seoDescription || undefined,
        thumbnailMediaId: values.thumbnailMediaId ?? undefined,
      };
      const result = id
        ? await api.PUT("/api/v1/admin/articles/{id}", { params: { path: { id } }, body })
        : await api.POST("/api/v1/admin/articles", { body });
      if (!result.response.ok) throw new Error(apiError(result.error, "Could not save this article."));
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["articles"] });
      setEditing(null);
      show("Article saved");
    },
    onError: (error: Error) => setFormError(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const { response } = await api.DELETE("/api/v1/admin/articles/{id}", { params: { path: { id } } });
      if (!response.ok) throw new Error("Could not delete this article.");
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["articles"] });
      show("Article deleted");
    },
  });

  const addButton = (
    <Button onClick={() => { setFormError(null); setEditing({ values: empty() }); }}>Write article</Button>
  );
  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    editing && setEditing({ ...editing, values: { ...editing.values, [key]: value } });

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Articles"
        action={
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted">Status</span>
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value as ArticleStatus | "")}
                className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm"
              >
                <option value="">All</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s.toLowerCase()}</option>
                ))}
              </select>
            </label>
            {addButton}
          </div>
        }
      />

      {list.isLoading ? (
        <ListSkeleton />
      ) : list.error ? (
        <ErrorState message="Could not load articles." onRetry={() => list.refetch()} />
      ) : (list.data ?? []).length === 0 ? (
        <EmptyState message="No articles yet — write your first one." action={addButton} />
      ) : (
        <ul className="flex flex-col gap-3">
          {(list.data ?? []).map((article) => (
            <li key={article.id}>
              <Card className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{article.title}</p>
                  <p className="truncate text-sm text-muted">
                    /{article.slug}
                    {article.publishedAt
                      ? ` · ${new Date(article.publishedAt).toLocaleString("en-GB")}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={article.status} />
                  <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => article.id && openEdit(article.id)}>
                    Edit
                  </Button>
                  <Button variant="danger" className="px-3 py-1.5 text-xs" onClick={() => article.id && remove.mutate(article.id)}>
                    Delete
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Modal open={editing !== null} title={editing?.id ? "Edit article" : "Write article"} onClose={() => setEditing(null)}>
        {editing ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate({ id: editing.id, values: editing.values });
            }}
            className="flex flex-col gap-4"
          >
            <Field label="Title">
              <input required value={editing.values.title} onChange={(e) => set("title", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Slug" optional hint="Derived from the title when left empty.">
              <input value={editing.values.slug} onChange={(e) => set("slug", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Excerpt" optional>
              <textarea rows={2} value={editing.values.excerpt} onChange={(e) => set("excerpt", e.target.value)} className={inputClass} />
            </Field>
            <Field
              label="Content (HTML)"
              hint="Sanitized on save against an allow-list — scripts, iframes and event handlers are removed."
            >
              <textarea
                required
                rows={12}
                value={editing.values.content}
                onChange={(e) => set("content", e.target.value)}
                className={`${inputClass} font-mono text-xs`}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category" optional hint="Created if it does not exist.">
                <input value={editing.values.category} onChange={(e) => set("category", e.target.value)} className={inputClass} />
              </Field>
              <Field label="Tags" optional hint="Comma-separated.">
                <input value={editing.values.tags} onChange={(e) => set("tags", e.target.value)} className={inputClass} />
              </Field>
              <Field label="Status">
                <select value={editing.values.status} onChange={(e) => set("status", e.target.value as ArticleStatus)} className={inputClass}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s.toLowerCase()}</option>
                  ))}
                </select>
              </Field>
              <Field
                label="Publish at"
                optional
                hint={editing.values.status === "SCHEDULED" ? "Must be in the future." : "Defaults to now when publishing."}
              >
                <input
                  type="datetime-local"
                  value={editing.values.publishedAt}
                  onChange={(e) => set("publishedAt", e.target.value)}
                  className={inputClass}
                />
              </Field>
              {/* Uploads here, on the article's own form — not in the Media library first. */}
              <Field label="Thumbnail" optional>
                <MediaPicker
                  value={editing.values.thumbnailMediaId}
                  onChange={(id) => set("thumbnailMediaId", id)}
                  label="thumbnail"
                />
              </Field>
              <Field label="SEO title" optional>
                <input value={editing.values.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} className={inputClass} />
              </Field>
            </div>
            <Field label="SEO description" optional>
              <textarea rows={2} value={editing.values.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} className={inputClass} />
            </Field>

            {formError ? <p role="alert" className="text-sm text-warning">{formError}</p> : null}

            <div className="mt-2 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Toast message={toast} />
    </div>
  );
}
