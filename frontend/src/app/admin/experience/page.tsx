"use client";

import { ContentScreen, STATUS_OPTIONS, type FieldSpec } from "@/components/admin/ui/content-screen";

const FIELDS: FieldSpec[] = [
  { name: "company", label: "Company", required: true },
  {
    name: "companyUrl",
    label: "Company website",
    optional: true,
    hint: "Linked from the company name wherever the role is shown.",
  },
  { name: "position", label: "Position", required: true },
  {
    name: "employmentType",
    label: "Employment type",
    type: "select",
    optional: true,
    options: ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP", "FREELANCE"].map((value) => ({
      value,
      label: value.replace("_", " ").toLowerCase(),
    })),
  },
  { name: "startDate", label: "Start date", type: "date", required: true },
  { name: "endDate", label: "End date", type: "date", optional: true, hint: "Leave empty if this is your current role." },
  { name: "currentlyWorking", label: "I currently work here", type: "checkbox" },
  { name: "description", label: "Description", type: "textarea", optional: true },
  { name: "responsibilities", label: "Responsibilities", type: "textarea", optional: true },
  { name: "companyLogoMediaId", label: "Company logo", type: "media", optional: true },
  { name: "displayOrder", label: "Display order", type: "number", optional: true },
  { name: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
];

export default function AdminExperiencePage() {
  return (
    <ContentScreen
      title="Experience"
      queryKey="experience"
      listPath="/api/v1/admin/experience"
      itemPath="/api/v1/admin/experience/{id}"
      fields={FIELDS}
      emptyMessage="No roles yet — add your first one."
      addLabel="Add role"
      toRow={(item) => ({
        id: item.id as number,
        title: String(item.position ?? ""),
        subtitle: String(item.company ?? ""),
        status: item.status as string,
      })}
      toForm={(item) => ({
        company: item?.company ?? "",
        companyUrl: item?.companyUrl ?? null,
        position: item?.position ?? "",
        employmentType: item?.employmentType ?? null,
        startDate: item?.startDate ?? "",
        endDate: item?.endDate ?? null,
        currentlyWorking: item?.currentlyWorking ?? false,
        description: item?.description ?? null,
        responsibilities: item?.responsibilities ?? null,
        companyLogoMediaId: (item?.companyLogo as { id?: number } | undefined)?.id ?? null,
        displayOrder: item?.displayOrder ?? 0,
        status: item?.status ?? "DRAFT",
        // Technologies are edited as a comma-separated list; the API resolves-or-creates them.
        technologies: item?.technologies ?? [],
      })}
    />
  );
}
