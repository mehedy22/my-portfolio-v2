import { z } from "zod";
import { contentModule } from "../../common/content.js";

const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

const schema = z.object({
  title: z.string().trim().min(1, "must not be blank").max(200),
  description: z.string().nullish(),
  achievedOn: z.string().nullish(),
  imageMediaId: z.number().nullish(),
  displayOrder: z.number().int().nullish(),
  status: z.enum(STATUSES).nullish(),
  aiVisible: z.boolean().nullish(),
});

export const achievementModule = contentModule({
  table: "achievement",
  publicPath: "achievements",
  defaultStatus: "PUBLISHED",
  createSchema: schema,
  updateSchema: schema,
  columns: [
    { column: "title", field: "title" },
    { column: "description", field: "description" },
    { column: "achieved_on", field: "achievedOn", type: "date" },
  ],
  mediaColumn: { column: "image_media_id", field: "imageMediaId", responseField: "image" },
});
