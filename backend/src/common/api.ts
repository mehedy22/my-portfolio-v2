import type { Response } from "express";

/**
 * The response envelope fixed in docs/07-api/api-conventions.md, reproduced exactly so the
 * frontend's generated client works against either implementation without a change.
 */
export type ApiResponse<T> = {
  success: true;
  data: T | null;
  message: string | null;
  timestamp: string;
};

export function ok<T>(res: Response, data: T | null, message: string | null = null): Response {
  return res.json(envelope(data, message));
}

export function created<T>(res: Response, data: T | null, message: string | null = null): Response {
  return res.status(201).json(envelope(data, message));
}

export function noContent(res: Response): Response {
  return res.status(204).send();
}

function envelope<T>(data: T | null, message: string | null): ApiResponse<T> {
  return { success: true, data, message, timestamp: new Date().toISOString() };
}

/** The pagination wrapper used by every paginated admin list. */
export type PageResponse<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export function page<T>(content: T[], pageNumber: number, size: number, total: number): PageResponse<T> {
  return {
    content,
    page: pageNumber,
    size,
    totalElements: total,
    totalPages: size > 0 ? Math.ceil(total / size) : 0,
  };
}

/** Clamps a requested page size the way the Java services do. */
export function pageParams(query: Record<string, unknown>, defaultSize = 20, maxSize = 100) {
  const page = Math.max(Number.parseInt(String(query.page ?? "0"), 10) || 0, 0);
  const requested = Number.parseInt(String(query.size ?? defaultSize), 10) || defaultSize;
  const size = Math.min(Math.max(requested, 1), maxSize);
  return { page, size, offset: page * size };
}
