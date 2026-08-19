"use client";

import { Button, Field, inputClass } from "@/components/admin/ui/primitives";
import type { components } from "@/generated/api/schema";

type Project = components["schemas"]["ProjectResponse"];

/** Mirrors the API's ck_project_type CHECK; "" means "not set". */
export type ProjectTypeValue = NonNullable<Project["projectType"]> | "";
export const PROJECT_TYPES: NonNullable<Project["projectType"]>[] = [
  "PERSONAL",
  "PROFESSIONAL",
  "OPEN_SOURCE",
  "CLIENT",
];

export type ChallengeBlock = { title: string; challenge: string; solution: string };

export type ProjectFormValues = {
  title: string;
  slug: string;
  shortDescription: string;
  detailedDescription: string;
  features: string;
  githubUrl: string;
  liveUrl: string;
  projectType: ProjectTypeValue;
  startDate: string;
  endDate: string;
  featured: boolean;
  displayOrder: number;
  thumbnailMediaId: number | null;
  technologies: string;
  galleryMediaIds: string;
  challenges: ChallengeBlock[];
};

export function emptyProject(): ProjectFormValues {
  return {
    title: "",
    slug: "",
    shortDescription: "",
    detailedDescription: "",
    features: "",
    githubUrl: "",
    liveUrl: "",
    projectType: "",
    startDate: "",
    endDate: "",
    featured: false,
    displayOrder: 0,
    thumbnailMediaId: null,
    technologies: "",
    galleryMediaIds: "",
    challenges: [],
  };
}

export function toFormValues(project: Project): ProjectFormValues {
  return {
    title: project.title ?? "",
    slug: project.slug ?? "",
    shortDescription: project.shortDescription ?? "",
    detailedDescription: project.detailedDescription ?? "",
    features: project.features ?? "",
    githubUrl: project.githubUrl ?? "",
    liveUrl: project.liveUrl ?? "",
    projectType: project.projectType ?? "",
    startDate: project.startDate ?? "",
    endDate: project.endDate ?? "",
    featured: project.featured ?? false,
    displayOrder: project.displayOrder ?? 0,
    thumbnailMediaId: project.thumbnail?.id ?? null,
    technologies: (project.technologies ?? []).join(", "),
    galleryMediaIds: (project.gallery ?? []).map((item) => item.id).join(", "),
    challenges: (project.challenges ?? []).map((block) => ({
      title: block.title ?? "",
      challenge: block.challenge ?? "",
      solution: block.solution ?? "",
    })),
  };
}

/**
 * The whole aggregate in one form, because the API replaces it in one call: whatever the
 * challenges, technologies and gallery are here becomes the complete set on save.
 *
 * <p>Status is deliberately absent — publishing is the separate PATCH on the list screen, so a
 * routine content edit cannot publish a draft by accident.
 */
export function ProjectForm({
  values,
  error,
  saving,
  onChange,
  onSubmit,
  onCancel,
}: {
  values: ProjectFormValues;
  error: string | null;
  saving: boolean;
  onChange: (values: ProjectFormValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const set = <K extends keyof ProjectFormValues>(key: K, value: ProjectFormValues[K]) =>
    onChange({ ...values, [key]: value });

  const setChallenge = (index: number, patch: Partial<ChallengeBlock>) =>
    onChange({
      ...values,
      challenges: values.challenges.map((block, position) =>
        position === index ? { ...block, ...patch } : block,
      ),
    });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="flex flex-col gap-4"
    >
      <Field label="Title">
        <input
          required
          value={values.title}
          onChange={(event) => set("title", event.target.value)}
          className={inputClass}
        />
      </Field>

      <Field
        label="Slug"
        optional
        hint="Leave empty to derive it from the title. A duplicate you type yourself is rejected."
      >
        <input
          value={values.slug}
          onChange={(event) => set("slug", event.target.value)}
          className={inputClass}
        />
      </Field>

      <Field label="Short description">
        <textarea
          required
          rows={2}
          value={values.shortDescription}
          onChange={(event) => set("shortDescription", event.target.value)}
          className={inputClass}
        />
      </Field>

      <Field label="Detailed description" optional>
        <textarea
          rows={4}
          value={values.detailedDescription}
          onChange={(event) => set("detailedDescription", event.target.value)}
          className={inputClass}
        />
      </Field>

      <Field label="Features" optional hint="Freeform — markdown bullets work well.">
        <textarea
          rows={3}
          value={values.features}
          onChange={(event) => set("features", event.target.value)}
          className={inputClass}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="GitHub URL" optional>
          <input
            value={values.githubUrl}
            onChange={(event) => set("githubUrl", event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Live URL" optional>
          <input
            value={values.liveUrl}
            onChange={(event) => set("liveUrl", event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Type" optional>
          <select
            value={values.projectType}
            onChange={(event) => set("projectType", event.target.value as ProjectTypeValue)}
            className={inputClass}
          >
            <option value="">—</option>
            {PROJECT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type.replace("_", " ").toLowerCase()}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Display order" optional>
          <input
            type="number"
            value={values.displayOrder}
            onChange={(event) => set("displayOrder", Number(event.target.value))}
            className={inputClass}
          />
        </Field>
        <Field label="Start date" optional>
          <input
            type="date"
            value={values.startDate}
            onChange={(event) => set("startDate", event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="End date" optional>
          <input
            type="date"
            value={values.endDate}
            onChange={(event) => set("endDate", event.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Technologies" optional hint="Comma-separated. Unknown names are created.">
        <input
          value={values.technologies}
          onChange={(event) => set("technologies", event.target.value)}
          placeholder="Spring Boot, Redis"
          className={inputClass}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Thumbnail media id" optional hint="Upload in the Media library first.">
          <input
            type="number"
            value={values.thumbnailMediaId ?? ""}
            onChange={(event) =>
              set("thumbnailMediaId", event.target.value === "" ? null : Number(event.target.value))
            }
            className={inputClass}
          />
        </Field>
        <Field label="Gallery media ids" optional hint="Comma-separated, in display order.">
          <input
            value={values.galleryMediaIds}
            onChange={(event) => set("galleryMediaIds", event.target.value)}
            placeholder="4, 5, 6"
            className={inputClass}
          />
        </Field>
      </div>

      <fieldset className="rounded-xl border border-border p-4">
        <legend className="px-2 text-sm font-medium">Challenges &amp; solutions</legend>
        <div className="flex flex-col gap-4">
          {values.challenges.map((block, index) => (
            <div key={index} className="flex flex-col gap-2 border-b border-border pb-4 last:border-0 last:pb-0">
              <input
                placeholder="Title"
                value={block.title}
                onChange={(event) => setChallenge(index, { title: event.target.value })}
                className={inputClass}
              />
              <textarea
                rows={2}
                placeholder="Challenge"
                value={block.challenge}
                onChange={(event) => setChallenge(index, { challenge: event.target.value })}
                className={inputClass}
              />
              <textarea
                rows={2}
                placeholder="Solution"
                value={block.solution}
                onChange={(event) => setChallenge(index, { solution: event.target.value })}
                className={inputClass}
              />
              <Button
                type="button"
                variant="danger"
                className="self-start px-3 py-1.5 text-xs"
                onClick={() =>
                  onChange({
                    ...values,
                    challenges: values.challenges.filter((_, position) => position !== index),
                  })
                }
              >
                Remove block
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            className="self-start"
            onClick={() =>
              onChange({
                ...values,
                challenges: [...values.challenges, { title: "", challenge: "", solution: "" }],
              })
            }
          >
            Add block
          </Button>
        </div>
      </fieldset>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={values.featured}
          onChange={(event) => set("featured", event.target.checked)}
        />
        Featured on the home page
      </label>

      {error ? (
        <p role="alert" className="text-sm text-warning">
          {error}
        </p>
      ) : null}

      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
