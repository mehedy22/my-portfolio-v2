import { z } from "zod";
import { ValidationError } from "../../common/errors.js";
import { contentModule } from "../../common/content.js";

const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

const schema = z.object({
  name: z.string().trim().min(1, "must not be blank").max(200),
  issuer: z.string().trim().min(1, "must not be blank").max(200),
  credentialId: z.string().max(200).nullish(),
  credentialUrl: z.string().max(500).nullish(),
  issueDate: z.string().nullish(),
  expiryDate: z.string().nullish(),
  description: z.string().nullish(),
  certificateImageMediaId: z.number().nullish(),
  displayOrder: z.number().int().nullish(),
  status: z.enum(STATUSES).nullish(),
  aiVisible: z.boolean().nullish(),
});

export const certificationModule = contentModule({
  table: "certification",
  // Plural on the public side, matching routes-and-layouts.md (D-022).
  publicPath: "certifications",
  defaultStatus: "PUBLISHED",
  createSchema: schema,
  updateSchema: schema,
  columns: [
    { column: "name", field: "name" },
    { column: "issuer", field: "issuer" },
    { column: "credential_id", field: "credentialId" },
    { column: "credential_url", field: "credentialUrl" },
    { column: "issue_date", field: "issueDate", type: "date" },
    { column: "expiry_date", field: "expiryDate", type: "date" },
    { column: "description", field: "description" },
  ],
  mediaColumn: {
    column: "certificate_image_media_id",
    field: "certificateImageMediaId",
    responseField: "certificateImage",
  },
  validate(values) {
    const issued = values.issueDate as string | null;
    const expires = values.expiryDate as string | null;
    if (issued && expires && expires < issued) {
      throw new ValidationError("Expiry date must not be before the issue date");
    }
  },
});
