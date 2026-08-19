/**
 * The exception hierarchy from docs/11-technical-design/backend-design.md, with the same stable
 * error codes and HTTP statuses. Nothing else in the codebase sets a status directly.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fieldErrors?: { field: string; message: string }[],
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** 400 — invalid input Bean-Validation-style checks cannot express. */
export class ValidationError extends ApiError {
  constructor(message: string, fieldErrors?: { field: string; message: string }[]) {
    super(400, "VALIDATION_ERROR", message, fieldErrors);
  }
}

/** 401 — missing, invalid or expired credentials. */
export class UnauthorizedError extends ApiError {
  constructor(message = "Authentication required") {
    super(401, "UNAUTHORIZED", message);
  }
}

/** 404 — absent, or present but not published. The public API never distinguishes the two. */
export class NotFoundError extends ApiError {
  constructor(message: string) {
    super(404, "NOT_FOUND", message);
  }
}

/** 409 — a unique constraint the caller can do something about, e.g. a duplicate slug. */
export class ConflictError extends ApiError {
  constructor(message: string) {
    super(409, "CONFLICT", message);
  }
}

/** 429 — throttled. */
export class RateLimitError extends ApiError {
  constructor(message: string) {
    super(429, "RATE_LIMITED", message);
  }
}
