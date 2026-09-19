import type { Response } from "express";

export function ok<T>(res: Response, data: T, meta?: Record<string, unknown>, status = 200) {
  return res.status(status).json({
    success: true,
    data,
    ...(meta ? { meta } : {}),
  });
}

export function created<T>(res: Response, data: T, meta?: Record<string, unknown>) {
  return ok(res, data, meta, 201);
}

export function paginated<T>(
  res: Response,
  data: T[],
  page: number,
  limit: number,
  total: number,
) {
  return ok(res, data, {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
}

export function fail(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  return res.status(status).json({
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  });
}
