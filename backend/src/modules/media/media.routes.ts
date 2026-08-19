import { Router } from "express";
import multer from "multer";
import { env } from "../../config/env.js";
import { created, noContent, ok } from "../../common/api.js";
import { handler, idParam } from "../../common/http.js";
import * as media from "./media.service.js";

/** Buffered in memory: the per-type limits are small, and nothing touches disk until it passes. */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.media.maxUploadBytes },
});

export const mediaPublicRouter = Router();
export const mediaAdminRouter = Router();

mediaAdminRouter.post(
  "/admin/media",
  upload.single("file"),
  handler(async (req, res) => {
    const uploaded = await media.upload(
      req.file as { buffer: Buffer; originalname: string },
      typeof req.body?.altText === "string" ? req.body.altText : undefined,
      req.adminId!,
    );
    return created(res, uploaded, "File uploaded");
  }),
);

mediaAdminRouter.get(
  "/admin/media",
  handler(async (req, res) => ok(res, await media.list(req.query))),
);

mediaAdminRouter.delete(
  "/admin/media/:id",
  handler(async (req, res) => {
    await media.remove(idParam(req));
    return noContent(res);
  }),
);

/**
 * Public because the site renders images to anonymous visitors (D-005). Stored bytes are
 * immutable — a given id always serves the same file — so it is cached hard.
 */
mediaPublicRouter.get(
  "/media/:id/content",
  handler(async (req, res) => {
    const content = await media.loadContent(idParam(req));
    res.setHeader("Content-Type", content.mimeType);
    res.setHeader("Content-Length", content.sizeBytes);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    // The type was verified by content sniffing on upload, so it is safe to declare — but nosniff
    // keeps the browser from second-guessing it into something executable.
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${content.originalFileName.replace(/"/g, "")}"`,
    );
    content.stream.pipe(res);
    return res;
  }),
);
