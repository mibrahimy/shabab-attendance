// Typed application errors (ENGINEERING.md §7). Services throw these; the API
// layer maps them to a status code + the `{ error: { code, message } }` envelope.
// A raw Prisma error / stack trace must never reach the client.

export class AppError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
  }
}

export class ValidationError extends AppError {
  constructor(message = "Invalid input", code = "VALIDATION_ERROR") {
    super(400, code, message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Not authenticated", code = "UNAUTHORIZED") {
    super(401, code, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Not allowed", code = "FORBIDDEN") {
    super(403, code, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found", code = "NOT_FOUND") {
    super(404, code, message);
  }
}

type ErrorResponse = {
  body: { error: { code: string; message: string } };
  status: number;
};

// Map any thrown value to a safe response. Known AppErrors pass through their
// code/message; anything else is masked as a 500 (no internal detail leaked).
export function toErrorResponse(err: unknown): ErrorResponse {
  if (err instanceof AppError) {
    return { status: err.status, body: { error: { code: err.code, message: err.message } } };
  }
  // Unexpected: log server-side (never leak detail to the client).
  console.error("[unhandled]", err);
  return {
    status: 500,
    body: { error: { code: "INTERNAL_ERROR", message: "Something went wrong" } },
  };
}
