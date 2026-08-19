"use client";

import { ContentScreen, STATUS_OPTIONS, type FieldSpec } from "@/components/admin/ui/content-screen";

const FIELDS: FieldSpec[] = [
  { name: "name", label: "Name", required: true },
  { name: "issuer", label: "Issuer", required: true },
  { name: "credentialId", label: "Credential id", optional: true },
  { name: "credentialUrl", label: "Verification URL", optional: true },
  { name: "issueDate", label: "Issued", type: "date", optional: true },
  { name: "expiryDate", label: "Expires", type: "date", optional: true },
  { name: "description", label: "Description", type: "textarea", optional: true },
  { name: "certificateImageMediaId", label: "Certificate image", type: "media", optional: true },
  { name: "displayOrder", label: "Display order", type: "number", optional: true },
  { name: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
];

export default function AdminCertificationsPage() {
  return (
    <ContentScreen
      title="Certifications"
      queryKey="certifications"
      listPath="/api/v1/admin/certifications"
      itemPath="/api/v1/admin/certifications/{id}"
      fields={FIELDS}
      emptyMessage="No certifications yet — add your first one."
      addLabel="Add certification"
      toRow={(item) => ({
        id: item.id as number,
        title: String(item.name ?? ""),
        subtitle: String(item.issuer ?? ""),
        status: item.status as string,
      })}
      toForm={(item) => ({
        name: item?.name ?? "",
        issuer: item?.issuer ?? "",
        credentialId: item?.credentialId ?? null,
        credentialUrl: item?.credentialUrl ?? null,
        issueDate: item?.issueDate ?? null,
        expiryDate: item?.expiryDate ?? null,
        description: item?.description ?? null,
        certificateImageMediaId:
          (item?.certificateImage as { id?: number } | undefined)?.id ?? null,
        displayOrder: item?.displayOrder ?? 0,
        status: item?.status ?? "PUBLISHED",
      })}
    />
  );
}
