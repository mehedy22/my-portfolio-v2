"use client";

import { ContentScreen, STATUS_OPTIONS, type FieldSpec } from "@/components/admin/ui/content-screen";

const FIELDS: FieldSpec[] = [
  { name: "institution", label: "Institution", required: true },
  { name: "degree", label: "Degree", optional: true },
  { name: "field", label: "Field of study", optional: true },
  {
    name: "result",
    label: "Result",
    optional: true,
    hint: "GPA, CGPA, class or grade — whatever was awarded, e.g. 3.85 / 4.00 or First Class.",
  },
  { name: "startDate", label: "Start date", type: "date", optional: true },
  { name: "endDate", label: "End date", type: "date", optional: true },
  { name: "currentlyStudying", label: "Currently studying here", type: "checkbox" },
  { name: "description", label: "Description", type: "textarea", optional: true },
  { name: "logoMediaId", label: "Institution logo", type: "media", optional: true },
  { name: "displayOrder", label: "Display order", type: "number", optional: true },
  { name: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
];

export default function AdminEducationPage() {
  return (
    <ContentScreen
      title="Education"
      queryKey="education"
      listPath="/api/v1/admin/education"
      itemPath="/api/v1/admin/education/{id}"
      fields={FIELDS}
      emptyMessage="No education entries yet — add your first one."
      addLabel="Add entry"
      toRow={(item) => ({
        id: item.id as number,
        title: String(item.institution ?? ""),
        subtitle: [item.degree, item.field].filter(Boolean).join(" · "),
        status: item.status as string,
      })}
      toForm={(item) => ({
        institution: item?.institution ?? "",
        degree: item?.degree ?? null,
        field: item?.field ?? null,
        result: item?.result ?? null,
        startDate: item?.startDate ?? null,
        endDate: item?.endDate ?? null,
        currentlyStudying: item?.currentlyStudying ?? false,
        description: item?.description ?? null,
        logoMediaId: (item?.logo as { id?: number } | undefined)?.id ?? null,
        displayOrder: item?.displayOrder ?? 0,
        status: item?.status ?? "PUBLISHED",
      })}
    />
  );
}
