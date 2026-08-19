"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, apiError } from "@/lib/admin/api";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  PageHeader,
  StatusBadge,
  Toast,
} from "@/components/admin/ui/primitives";
import { Modal } from "@/components/admin/ui/modal";
import { useToast } from "@/lib/admin/use-toast";
import { ProjectForm, type ProjectFormValues, emptyProject, toFormValues } from "@/components/admin/project-form";
import type { components } from "@/generated/api/schema";

type Project = components["schemas"]["ProjectResponse"];
const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
type ProjectStatus = (typeof STATUSES)[number];

export default function AdminProjectsPage() {
  const client = useQueryClient();
  const { message: toast, show } = useToast();
  const [filter, setFilter] = useState<ProjectStatus | "">("");
  const [editing, setEditing] = useState<{ id?: number; values: ProjectFormValues } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["projects", filter],
    queryFn: async () => {
      const { data, response } = await api.GET("/api/v1/admin/projects", {
        params: { query: { page: 0, size: 100, ...(filter ? { status: filter } : {}) } },
      });
      if (!response.ok) throw new Error("Could not load projects.");
      return data?.data?.content ?? [];
    },
  });

  /** The form edits the whole aggregate, so editing loads the full detail, not the list row. */
  async function openEdit(id: number) {
    const { data, response } = await api.GET("/api/v1/admin/projects/{id}", {
      params: { path: { id } },
    });
    if (!response.ok || !data?.data) {
      show("Could not open that project");
      return;
    }
    setFormError(null);
    setEditing({ id, values: toFormValues(data.data as Project) });
  }

  const save = useMutation({
    mutationFn: async ({ id, values }: { id?: number; values: ProjectFormValues }) => {
      const body = {
        title: values.title,
        slug: values.slug || undefined,
        shortDescription: values.shortDescription,
        detailedDescription: values.detailedDescription || undefined,
        features: values.features || undefined,
        githubUrl: values.githubUrl || undefined,
        liveUrl: values.liveUrl || undefined,
        projectType: values.projectType || undefined,
        startDate: values.startDate || undefined,
        endDate: values.endDate || undefined,
        featured: values.featured,
        displayOrder: values.displayOrder,
        thumbnailMediaId: values.thumbnailMediaId ?? undefined,
        // Whatever is sent becomes the complete set — the API replaces these wholesale.
        technologies: values.technologies
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        galleryMediaIds: values.galleryMediaIds
          .split(",")
          .map((item) => Number(item.trim()))
          .filter((item) => Number.isFinite(item) && item > 0),
        challenges: values.challenges.filter((block) => block.title.trim()),
      };

      const result = id
        ? await api.PUT("/api/v1/admin/projects/{id}", { params: { path: { id } }, body })
        : await api.POST("/api/v1/admin/projects", { body });

      // A duplicate slug comes back as 409 with a clear message — surface it verbatim.
      if (!result.response.ok) {
        throw new Error(apiError(result.error, "Could not save this project."));
      }
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["projects"] });
      setEditing(null);
      show("Project saved");
    },
    onError: (error: Error) => setFormError(error.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: ProjectStatus }) => {
      const { response } = await api.PATCH("/api/v1/admin/projects/{id}/status", {
        params: { path: { id } },
        body: { status },
      });
      if (!response.ok) throw new Error("Could not change the status.");
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["projects"] });
      show("Status updated");
    },
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const { response } = await api.DELETE("/api/v1/admin/projects/{id}", {
        params: { path: { id } },
      });
      if (!response.ok) throw new Error("Could not delete this project.");
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["projects"] });
      show("Project deleted");
    },
  });

  const addButton = (
    <Button
      onClick={() => {
        setFormError(null);
        setEditing({ values: emptyProject() });
      }}
    >
      Add project
    </Button>
  );

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Projects"
        action={
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted">Status</span>
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value as ProjectStatus | "")}
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
            {addButton}
          </div>
        }
      />

      {list.isLoading ? (
        <ListSkeleton />
      ) : list.error ? (
        <ErrorState message="Could not load projects." onRetry={() => list.refetch()} />
      ) : (list.data ?? []).length === 0 ? (
        <EmptyState message="No projects yet — create your first one." action={addButton} />
      ) : (
        <ul className="flex flex-col gap-3">
          {(list.data ?? []).map((project) => (
            <li key={project.id}>
              <Card className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{project.title}</p>
                  <p className="truncate text-sm text-muted">/{project.slug}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={project.status} />
                  <select
                    value={project.status}
                    aria-label={`Status of ${project.title}`}
                    onChange={(event) =>
                      project.id && setStatus.mutate({ id: project.id, status: event.target.value as ProjectStatus })
                    }
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
                    onClick={() => project.id && openEdit(project.id)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    className="px-3 py-1.5 text-xs"
                    onClick={() => project.id && remove.mutate(project.id)}
                  >
                    Delete
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={editing !== null}
        title={editing?.id ? "Edit project" : "Add project"}
        onClose={() => setEditing(null)}
      >
        {editing ? (
          <ProjectForm
            values={editing.values}
            error={formError}
            saving={save.isPending}
            onChange={(values) => setEditing({ ...editing, values })}
            onCancel={() => setEditing(null)}
            onSubmit={() => save.mutate({ id: editing.id, values: editing.values })}
          />
        ) : null}
      </Modal>

      <Toast message={toast} />
    </div>
  );
}
