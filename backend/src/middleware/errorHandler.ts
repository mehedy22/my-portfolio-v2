import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { ApiError } from "../common/errors.js";

/**
 * Maps every failure to the error envelope in docs/07-api/api-conventions.md. Nothing else in the
 * codebase writes an error body, and a stack trace never reaches a client (NFR-05).
 */
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const body = (status: number, code: string, message: string, fieldErrors: unknown[] = []) => {
    res.status(status).json({
      success: false,
      timestamp: new Date().toISOString(),
      status,
      code,
      message,
      path: req.originalUrl.split("?")[0],
      errors: fieldErrors,
    });
  };

  if (error instanceof ApiError) {
    body(error.status, error.code, error.message, error.fieldErrors ?? []);
    return;
  }

  // An oversized body is refused by the upload middleware before any handler runs. There is no
  // 413 in the documented error table, so it maps to the 400 that is there.
  if (error instanceof multer.MulterError) {
    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "Uploaded file exceeds the maximum allowed size"
        : "Malformed or incomplete request";
    console.warn(`Rejected upload: ${error.code}`);
    body(400, "VALIDATION_ERROR", message);
    return;
  }

  // Malformed JSON is caught by the body parser and is squarely a client error, not a 500.
  if (error instanceof SyntaxError && "body" in error) {
    body(400, "VALIDATION_ERROR", "Request body is malformed or contains a value outside its allowed set");
    return;
  }

  console.error("Unhandled error:", error);
  body(500, "INTERNAL_ERROR", "An unexpected error occurred");
}

/** Anything not matched by a route. */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    timestamp: new Date().toISOString(),
    status: 404,
    code: "NOT_FOUND",
    message: "No endpoint matches this request",
    path: req.originalUrl.split("?")[0],
    errors: [],
  });
}
