import type { Request } from "express";
import { validationError } from "./AppError.js";

export function routeParam(req: Request, name: string): string {
  const value = req.params[name];
  const resolved = Array.isArray(value) ? value[0] : value;
  if (!resolved) throw validationError(`Missing ${name}`);
  return resolved;
}
