import { z } from "zod";
import { ValidationError } from "../../common/errors.js";
import { contentModule } from "../../common/content.js";

const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

const schema = z.object({
  institution: z.string().trim().min(1, "must not be blank").max(200),
  degree: z.string().max(200).nullish(),
  field: z.string().max(200).nullish(),
  result: z
    .string()
    .max(50)
    .nullish()
    .transform((value) => {
      const trimmed = value?.trim();
      return trimmed ? trimmed : null;
    }),
  description: z.string().nullish(),
  startDate: z.string().nullish(),
  endDate: z.string().nullish(),
  currentlyStudying: z.boolean().nullish(),
  logoMediaId: z.number().nullish(),
  displayOrder: z.number().int().nullish(),
  status: z.enum(STATUSES).nullish(),
  aiVisible: z.boolean().nullish(),
});

export const educationModule = contentModule({
  table: "education",
  publicPath: "education",
  defaultStatus: "PUBLISHED",
  createSchema: schema,
  updateSchema: schema,
  columns: [
    { column: "institution", field: "institution" },
    { column: "degree", field: "degree" },
    { column: "field", field: "field" },
    { column: "result", field: "result" },
    { column: "description", field: "description" },
    { column: "start_date", field: "startDate", type: "date" },
    { column: "end_date", field: "endDate", type: "date" },
    { column: "currently_studying", field: "currentlyStudying", type: "boolean" },
  ],
  mediaColumn: { column: "logo_media_id", field: "logoMediaId", responseField: "logo" },
  validate(values) {
    const start = values.startDate as string | null;
    const end = values.endDate as string | null;
    if (start && end && end < start) {
      throw new ValidationError("End date must not be before the start date");
    }
  },
});
