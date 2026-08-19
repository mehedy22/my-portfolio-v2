"use client";

import { ContentScreen, STATUS_OPTIONS, type FieldSpec } from "@/components/admin/ui/content-screen";

const FIELDS: FieldSpec[] = [
  { name: "title", label: "Title", required: true },
  { name: "description", label: "Description", type: "textarea", optional: true },
  { name: "achievedOn", label: "Achieved on", type: "date", optional: true },
  { name: "imageMediaId", label: "Image", type: "media", optional: true },
  { name: "displayOrder", label: "Display order", type: "number", optional: true },
  { name: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
];

export default function AdminAchievementsPage() {
  return (
    <ContentScreen
      title="Achievements"
      queryKey="achievements"
      listPath="/api/v1/admin/achievements"
      itemPath="/api/v1/admin/achievements/{id}"
      fields={FIELDS}
      emptyMessage="No achievements yet — add your first one."
      addLabel="Add achievement"
      toRow={(item) => ({
        id: item.id as number,
        title: String(item.title ?? ""),
        subtitle: item.achievedOn ? String(item.achievedOn) : undefined,
        status: item.status as string,
      })}
      toForm={(item) => ({
        title: item?.title ?? "",
        description: item?.description ?? null,
        achievedOn: item?.achievedOn ?? null,
        imageMediaId: (item?.image as { id?: number } | undefined)?.id ?? null,
        displayOrder: item?.displayOrder ?? 0,
        status: item?.status ?? "PUBLISHED",
      })}
    />
  );
}
