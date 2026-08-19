import { z } from "zod";
import { pool } from "../../db/pool.js";
import { ConflictError } from "../../common/errors.js";
import { contentModule } from "../../common/content.js";

/**
 * Problem-solving profiles (LeetCode, Codeforces, and the rest).
 *
 * <p>Uses the shared content factory: the behaviour is the same as every other simple module —
 * published-only public reads, whole-row replace, soft delete — and only the columns differ.
 */
const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

const schema = z.object({
  platform: z.string().trim().min(1, "must not be blank").max(50),
  handle: z.string().trim().min(1, "must not be blank").max(100),
  profileUrl: z.string().max(500).nullish(),
  problemsSolved: z.number().int().min(0).nullish(),
  rating: z.number().int().min(0).nullish(),
  rankTitle: z.string().max(100).nullish(),
  displayOrder: z.number().int().nullish(),
  status: z.enum(STATUSES).nullish(),
  aiVisible: z.boolean().nullish(),
});

export const problemSolvingModule = contentModule({
  table: "problem_solving_profile",
  publicPath: "problem-solving",
  adminPath: "problem-solving",
  defaultStatus: "PUBLISHED",
  createSchema: schema,
  updateSchema: schema,
  columns: [
    { column: "platform", field: "platform" },
    { column: "handle", field: "handle" },
    { column: "profile_url", field: "profileUrl" },
    { column: "problems_solved", field: "problemsSolved", type: "int" },
    { column: "rating", field: "rating", type: "int" },
    { column: "rank_title", field: "rankTitle" },
  ],
  /**
   * The unique index is the guarantee; this turns the constraint violation into the documented
   * 409 rather than letting it surface as a 500.
   */
  async afterSave(id, body) {
    const { rowCount } = await pool.query(
      `SELECT 1 FROM problem_solving_profile
       WHERE lower(platform) = lower($1) AND lower(handle) = lower($2)
         AND id <> $3 AND deleted_at IS NULL`,
      [body.platform, body.handle, id],
    );
    if (rowCount) {
      throw new ConflictError(`A ${body.platform} profile for '${body.handle}' already exists`);
    }
  },
});
