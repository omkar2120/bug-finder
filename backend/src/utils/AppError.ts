export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function notFound(message = "Resource not found") {
  return new AppError(404, "NOT_FOUND", message);
}

export function forbidden(message = "You are not authorized to access this resource") {
  return new AppError(403, "FORBIDDEN", message);
}

export function unauthorized(message = "Authentication required") {
  return new AppError(401, "UNAUTHORIZED", message);
}

export function conflict(message: string) {
  return new AppError(409, "CONFLICT", message);
}

export function validationError(message: string, details?: unknown) {
  return new AppError(400, "VALIDATION_ERROR", message, details);
}
