"use client";

import { ContentScreen, STATUS_OPTIONS, type FieldSpec } from "@/components/admin/ui/content-screen";

/**
 * Research entries (D-014). No rich-text body: an entry points at a paper hosted elsewhere or at
 * an uploaded PDF, so the form collects a link, not content.
 */
const FIELDS: FieldSpec[] = [
  { name: "title", label: "Title", required: true },
  { name: "abstractText", label: "Abstract", type: "textarea", required: true, hint: "Up to 600 characters." },
  { name: "publicationVenue", label: "Venue", optional: true, hint: "Conference or journal name." },
  { name: "publicationDate", label: "Published", type: "date", optional: true },
  { name: "externalUrl", label: "External URL", optional: true, hint: "Link to the paper. Required unless a PDF is attached." },
  { name: "pdfMediaId", label: "PDF", type: "media", optional: true, accept: "application/pdf" },
  { name: "tags", label: "Tags", optional: true, hint: "Comma-separated. Shared with Articles." },
  { name: "displayOrder", label: "Display order", type: "number", optional: true },
  { name: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
];

export default function AdminResearchPage() {
  return (
    <ContentScreen
      title="Research"
      queryKey="research"
      listPath="/api/v1/admin/research"
      itemPath="/api/v1/admin/research/{id}"
      fields={FIELDS}
      emptyMessage="No research entries yet — add your first one."
      addLabel="Add research"
      toRow={(item) => ({
        id: item.id as number,
        title: String(item.title ?? ""),
        subtitle: [item.publicationVenue, item.publicationDate].filter(Boolean).join(" · "),
        status: item.status as string,
      })}
      toForm={(item) => ({
        title: item?.title ?? "",
        abstractText: item?.abstractText ?? "",
        publicationVenue: item?.publicationVenue ?? null,
        publicationDate: item?.publicationDate ?? null,
        externalUrl: item?.externalUrl ?? null,
        pdfMediaId: (item?.pdf as { id?: number } | undefined)?.id ?? null,
        // The API takes an array; the form edits it as a comma-separated string.
        tags: Array.isArray(item?.tags) ? (item?.tags as string[]).join(", ") : "",
        displayOrder: item?.displayOrder ?? 0,
        status: item?.status ?? "DRAFT",
      })}
    />
  );
}
