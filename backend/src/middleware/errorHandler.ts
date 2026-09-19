import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import mongoose from "mongoose";
import { AppError } from "../utils/AppError.js";
import { fail } from "../utils/apiResponse.js";
import { logger } from "../utils/logger.js";
import { loadEnv } from "../config/env.js";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return fail(res, err.status, err.code, err.message, err.details);
  }

  if (err instanceof ZodError) {
    return fail(res, 400, "VALIDATION_ERROR", "Request validation failed", err.flatten());
  }

  if (err instanceof mongoose.Error.ValidationError) {
    return fail(res, 400, "VALIDATION_ERROR", "Invalid data", err.errors);
  }

  if (err instanceof mongoose.Error.CastError) {
    return fail(res, 400, "VALIDATION_ERROR", "Invalid identifier");
  }

  const mongoErr = err as { code?: number };
  if (mongoErr?.code === 11000) {
    return fail(res, 409, "CONFLICT", "A record with those values already exists");
  }

  logger.error("Unhandled error", {
    name: err instanceof Error ? err.name : "Error",
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });

  const env = loadEnv();
  const message =
    env.NODE_ENV === "production" || env.NODE_ENV === "test"
      ? "An unexpected error occurred"
      : err instanceof Error
        ? err.message
        : "An unexpected error occurred";

  return fail(res, 500, "INTERNAL_ERROR", message);
}

export function notFoundHandler(_req: Request, res: Response) {
  return fail(res, 404, "NOT_FOUND", "Endpoint not found");
}
