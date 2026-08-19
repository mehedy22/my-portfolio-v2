"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiError } from "@/lib/admin/api";
import { Button, PageHeader, Toast } from "@/components/admin/ui/primitives";
import { MediaPicker } from "@/components/admin/ui/media-picker";
import { ContentList, type ContentRow } from "@/components/admin/ui/content-list";
import { Modal } from "@/components/admin/ui/modal";
import { useToast } from "@/lib/admin/use-toast";

export type FieldSpec = {
  name: string;
  label: string;
  type?: "text" | "textarea" | "date" | "number" | "checkbox" | "select" | "media";
  options?: { value: string; label: string }[];
  required?: boolean;
  optional?: boolean;
  hint?: string;
  /** For {@code type: "media"} — which files the upload button offers. */
  accept?: string;
};

type Values = Record<string, unknown>;

/** Fields the API models as arrays but a form edits as a comma-separated string. */
const LIST_FIELDS = ["tags", "technologies"];

/**
 * One screen driving the whole CRUD loop for a simple content module: list, create, edit, delete.
 * Experience, Skills, Education and Certifications differ only in their field specs and how a row
 * is labelled, so the behaviour — optimistic-free invalidation, error surfacing, empty state,
 * modal form — is written once here rather than four times.
 */
export function ContentScreen({
  title,
  queryKey,
  listPath,
  itemPath,
  fields,
  toRow,
  toForm,
  emptyMessage,
  addLabel,
}: {
  title: string;
  queryKey: string;
  listPath: string;
  itemPath: string;
  fields: FieldSpec[];
  toRow: (item: Values) => ContentRow;
  toForm: (item: Values | null) => Values;
  emptyMessage: string;
  addLabel: string;
}) {
  const client = useQueryClient();
  const { message: toast, show } = useToast();
  const [editing, setEditing] = useState<Values | null | undefined>(undefined);
  const [values, setValues] = useState<Values>({});
  const [formError, setFormError] = useState<string | null>(null);

  const list = useQuery({
    queryKey: [queryKey],
    queryFn: async () => {
      const { data, response } = await api.GET(listPath as never, {} as never);
      if (!response.ok) throw new Error(`Could not load ${title.toLowerCase()}.`);
      return ((data as { data?: Values[] } | undefined)?.data ?? []) as Values[];
    },
  });

  const save = useMutation({
    mutationFn: async (payload: { id?: number; body: Values }) => {
      // Comma-separated list fields are edited as text and sent as arrays — the one shape
      // difference between what a form input holds and what the contract expects.
      const body: Values = { ...payload.body };
      for (const key of LIST_FIELDS) {
        if (typeof body[key] === "string") {
          body[key] = (body[key] as string).split(",").map((item) => item.trim()).filter(Boolean);
        }
      }
      payload = { ...payload, body };
      const result = payload.id
        ? await api.PUT(itemPath as never, {
            params: { path: { id: payload.id } },
            body: payload.body,
          } as never)
        : await api.POST(listPath as never, { body: payload.body } as never);

      // Field-level Bean Validation errors are far more useful than the envelope's summary.
      if (!result.response.ok) throw new Error(apiError(result.error, "Could not save."));
      return result;
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [queryKey] });
      setEditing(undefined);
      setFormError(null);
      show("Saved");
    },
    onError: (error: Error) => setFormError(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const { response } = await api.DELETE(itemPath as never, {
        params: { path: { id } },
      } as never);
      if (!response.ok) throw new Error("Could not delete.");
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [queryKey] });
      show("Deleted");
    },
  });

  const rows = useMemo(() => (list.data ?? []).map(toRow), [list.data, toRow]);

  function open(item: Values | null) {
    setEditing(item);
    setValues(toForm(item));
    setFormError(null);
  }

  const addButton = <Button onClick={() => open(null)}>{addLabel}</Button>;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={title} action={addButton} />

      <ContentList
        isLoading={list.isLoading}
        error={list.error}
        rows={rows}
        emptyMessage={emptyMessage}
        onRetry={() => list.refetch()}
        onEdit={(id) => open((list.data ?? []).find((item) => item.id === id) ?? null)}
        onDelete={(id) => remove.mutate(id)}
        action={addButton}
      />

      <Modal
        open={editing !== undefined}
        title={editing ? `Edit ${title.toLowerCase()}` : addLabel}
        onClose={() => setEditing(undefined)}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate({ id: editing?.id as number | undefined, body: values });
          }}
          className="flex flex-col gap-4"
        >
          {fields.map((field) => (
            <FormField
              key={field.name}
              field={field}
              value={values[field.name]}
              onChange={(value) => setValues((current) => ({ ...current, [field.name]: value }))}
            />
          ))}

          {formError ? (
            <p role="alert" className="text-sm text-warning">
              {formError}
            </p>
          ) : null}

          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setEditing(undefined)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </Modal>

      <Toast message={toast} />
    </div>
  );
}

function FormField({
  field,
  value,
  onChange,
}: {
  field: FieldSpec;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const inputClass =
    "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none transition focus:border-accent";

  if (field.type === "checkbox") {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
        />
        {field.label}
      </label>
    );
  }

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">
        {field.label}
        {field.optional ? <span className="ml-1 text-xs font-normal text-muted">(optional)</span> : null}
      </span>

      {field.type === "media" ? (
        <MediaPicker
          value={typeof value === "number" ? value : null}
          onChange={(id) => onChange(id)}
          label={field.label.toLowerCase()}
          accept={field.accept ?? "image/*"}
        />
      ) : field.type === "textarea" ? (
        <textarea
          rows={4}
          value={(value as string) ?? ""}
          required={field.required}
          onChange={(event) => onChange(event.target.value)}
          className={inputClass}
        />
      ) : field.type === "select" ? (
        <select
          value={(value as string) ?? ""}
          required={field.required}
          onChange={(event) => onChange(event.target.value || null)}
          className={inputClass}
        >
          <option value="">—</option>
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={field.type ?? "text"}
          value={(value as string | number) ?? ""}
          required={field.required}
          onChange={(event) =>
            onChange(
              field.type === "number"
                ? event.target.value === ""
                  ? null
                  : Number(event.target.value)
                : event.target.value || null,
            )
          }
          className={inputClass}
        />
      )}

      {field.hint ? <span className="text-xs text-muted">{field.hint}</span> : null}
    </label>
  );
}

export const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Draft" },
  { value: "PUBLISHED", label: "Published" },
  { value: "ARCHIVED", label: "Archived" },
];
