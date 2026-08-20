import { z } from "zod";
import { pool } from "../../db/pool.js";
import { ValidationError } from "../../common/errors.js";
import { contentModule } from "../../common/content.js";
import { resolveTechnologies } from "../technology/technology.service.js";

const EMPLOYMENT_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP", "FREELANCE"] as const;
const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

const schema = z.object({
  company: z.string().trim().min(1, "must not be blank").max(200),
  position: z.string().trim().min(1, "must not be blank").max(200),
  employmentType: z.enum(EMPLOYMENT_TYPES).nullish(),
  description: z.string().nullish(),
  responsibilities: z.string().nullish(),
  startDate: z.string().min(1, "must not be null"),
  endDate: z.string().nullish(),
  currentlyWorking: z.boolean().nullish(),
  companyLogoMediaId: z.number().nullish(),
  companyUrl: z
    .string()
    .max(500)
    .nullish()
    .transform((value) => {
      const trimmed = value?.trim();
      return trimmed ? trimmed : null;
    }),
  displayOrder: z.number().int().nullish(),
  status: z.enum(STATUSES).nullish(),
  aiVisible: z.boolean().nullish(),
  technologies: z.array(z.string()).nullish(),
});

export const experienceModule = contentModule({
  table: "experience",
  publicPath: "experience",
  defaultStatus: "DRAFT",
  createSchema: schema,
  updateSchema: schema,
  columns: [
    { column: "company", field: "company" },
    { column: "company_url", field: "companyUrl" },
    { column: "position", field: "position" },
    { column: "employment_type", field: "employmentType" },
    { column: "description", field: "description" },
    { column: "responsibilities", field: "responsibilities" },
    { column: "start_date", field: "startDate", type: "date" },
    { column: "end_date", field: "endDate", type: "date" },
    { column: "currently_working", field: "currentlyWorking", type: "boolean" },
  ],
  mediaColumn: {
    column: "company_logo_media_id",
    field: "companyLogoMediaId",
    responseField: "companyLogo",
  },
  /**
   * Mirrors ck_experience_dates and ck_experience_currently_working. The CHECKs are the
   * guarantee; these are the messages that make a rejection actionable instead of a 500.
   */
  validate(values) {
    const start = values.startDate as string;
    const end = values.endDate as string | null;
    if (end && start && end < start) {
      throw new ValidationError("End date must not be before the start date");
    }
    if (values.currentlyWorking === true && end) {
      throw new ValidationError("A role marked as current cannot also have an end date");
    }
  },
  async afterSave(id, body) {
    // Whatever is sent becomes the complete set — the join rows are replaced, not merged.
    const technologyIds = await resolveTechnologies(body.technologies as string[] | undefined);
    await pool.query("DELETE FROM experience_technology WHERE experience_id = $1", [id]);
    for (const technologyId of technologyIds) {
      await pool.query(
        "INSERT INTO experience_technology (experience_id, technology_id) VALUES ($1, $2)",
        [id, technologyId],
      );
    }
  },
  async enrich(rows) {
    if (!rows.length) return;
    const ids = rows.map((row) => row.id as number);
    const { rows: joined } = await pool.query<{ experience_id: number; name: string }>(
      `SELECT et.experience_id, t.name
       FROM experience_technology et JOIN technology t ON t.id = et.technology_id
       WHERE et.experience_id = ANY($1::bigint[])`,
      [ids],
    );
    const byExperience = new Map<number, string[]>();
    for (const row of joined) {
      byExperience.set(row.experience_id, [...(byExperience.get(row.experience_id) ?? []), row.name]);
    }
    for (const row of rows) {
      // Alphabetical, so chip order is stable across requests rather than insertion-dependent.
      row.technologies = (byExperience.get(row.id as number) ?? []).sort((a, b) =>
        a.toLowerCase().localeCompare(b.toLowerCase()),
      );
    }
  },
});
