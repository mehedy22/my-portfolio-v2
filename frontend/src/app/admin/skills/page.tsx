"use client";

import { ContentScreen, STATUS_OPTIONS, type FieldSpec } from "@/components/admin/ui/content-screen";

const FIELDS: FieldSpec[] = [
  { name: "name", label: "Skill", required: true },
  {
    name: "category",
    label: "Category",
    required: true,
    hint: "Typing a new category creates it; matching is case-insensitive.",
  },
  {
    name: "proficiency",
    label: "Proficiency",
    type: "select",
    optional: true,
    options: ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"].map((value) => ({
      value,
      label: value.toLowerCase(),
    })),
  },
  { name: "icon", label: "Icon class", optional: true },
  { name: "displayOrder", label: "Display order", type: "number", optional: true },
  { name: "featured", label: "Featured", type: "checkbox" },
  { name: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
];

export default function AdminSkillsPage() {
  return (
    <ContentScreen
      title="Skills"
      queryKey="skills"
      listPath="/api/v1/admin/skills"
      itemPath="/api/v1/admin/skills/{id}"
      fields={FIELDS}
      emptyMessage="No skills yet — add your first one."
      addLabel="Add skill"
      toRow={(item) => ({
        id: item.id as number,
        title: String(item.name ?? ""),
        subtitle: String(item.category ?? ""),
        status: item.status as string,
      })}
      toForm={(item) => ({
        name: item?.name ?? "",
        category: item?.category ?? "",
        proficiency: item?.proficiency ?? null,
        icon: item?.icon ?? null,
        displayOrder: item?.displayOrder ?? 0,
        featured: item?.featured ?? false,
        status: item?.status ?? "PUBLISHED",
      })}
    />
  );
}
