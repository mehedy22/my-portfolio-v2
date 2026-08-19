import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { requireAdmin } from "./middleware/auth.js";
import { adminAuthRouter, authRouter } from "./modules/auth/auth.routes.js";
import { mediaAdminRouter, mediaPublicRouter } from "./modules/media/media.routes.js";
import { projectAdminRouter, projectPublicRouter } from "./modules/project/project.module.js";
import { experienceModule } from "./modules/experience/experience.module.js";
import { educationModule } from "./modules/education/education.module.js";
import { certificationModule } from "./modules/certification/certification.module.js";
import { achievementModule } from "./modules/achievement/achievement.module.js";
import { skillAdminRouter, skillPublicRouter } from "./modules/skill/skill.module.js";
import { contactAdminRouter, contactPublicRouter } from "./modules/contact/contact.module.js";
import { settingsAdminRouter, settingsPublicRouter } from "./modules/settings/settings.module.js";
import { analyticsAdminRouter, analyticsPublicRouter } from "./modules/analytics/analytics.module.js";
import { blogAdminRouter, blogPublicRouter } from "./modules/blog/blog.module.js";
import { researchAdminRouter, researchPublicRouter } from "./modules/research/research.module.js";
import { problemSolvingModule } from "./modules/problemSolving/problemSolving.module.js";

export function createApp() {
  const app = express();

  // Behind a reverse proxy in every deployment; without this `req.ip` reports the proxy.
  app.set("trust proxy", true);
  app.disable("x-powered-by");

  /*
   * An explicit origin allow-list with credentials enabled — never a wildcard, because this API
   * issues JWTs and sets a refresh cookie that must not be exposed to arbitrary origins (NFR-08).
   */
  app.use(
    cors({
      origin: env.cors.allowedOrigins,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    }),
  );

  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.get("/health", (_req, res) => {
    res.json({ status: "UP" });
  });

  /*
   * The OpenAPI document is served as the contract this implementation must satisfy — the same
   * file the frontend generates its typed client from, so a drift between the two shows up as a
   * type error rather than a runtime surprise.
   */
  app.get("/v3/api-docs", async (_req, res, next) => {
    try {
      const spec = await readFile(join(dirname(fileURLToPath(import.meta.url)), "..", "openapi.json"), "utf8");
      res.type("application/json").send(spec);
    } catch (error) {
      next(error);
    }
  });

  const api = express.Router();

  // Public surface. Visitors never authenticate (D-005).
  api.use(authRouter);
  api.use(mediaPublicRouter);
  api.use(projectPublicRouter);
  api.use(experienceModule.publicRouter);
  api.use(educationModule.publicRouter);
  api.use(certificationModule.publicRouter);
  api.use(achievementModule.publicRouter);
  api.use(skillPublicRouter);
  api.use(contactPublicRouter);
  api.use(settingsPublicRouter);
  api.use(analyticsPublicRouter);
  api.use(blogPublicRouter);
  api.use(researchPublicRouter);
  api.use(problemSolvingModule.publicRouter);

  /*
   * Everything under /admin requires a valid access token. Applied as one guard on the path
   * prefix rather than per route, so a new admin endpoint is protected because of where it lives
   * — not because someone remembered to add a decorator.
   */
  api.use("/admin", (req, res, next) => requireAdmin(req, res, next));
  api.use(adminAuthRouter);
  api.use(mediaAdminRouter);
  api.use(projectAdminRouter);
  api.use(experienceModule.adminRouter);
  api.use(educationModule.adminRouter);
  api.use(certificationModule.adminRouter);
  api.use(achievementModule.adminRouter);
  api.use(skillAdminRouter);
  api.use(contactAdminRouter);
  api.use(settingsAdminRouter);
  api.use(analyticsAdminRouter);
  api.use(blogAdminRouter);
  api.use(researchAdminRouter);
  api.use(problemSolvingModule.adminRouter);

  app.use("/api/v1", api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
