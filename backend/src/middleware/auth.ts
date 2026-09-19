import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { loadEnv } from "../config/env.js";
import { fail } from "../utils/apiResponse.js";
import { User } from "../models/User.js";

export interface AccessPayload {
  sub: string;
  email: string;
  role: "admin" | "qa_engineer" | "viewer";
  name: string;
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) {
    return fail(res, 401, "UNAUTHORIZED", "Authentication required");
  }

  try {
    const env = loadEnv();
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessPayload;
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      name: payload.name,
    };
    return next();
  } catch {
    return fail(res, 401, "UNAUTHORIZED", "Invalid or expired access token");
  }
}

export function requireRole(...roles: Array<"admin" | "qa_engineer" | "viewer">) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return fail(res, 401, "UNAUTHORIZED", "Authentication required");
    if (req.user.role === "admin") return next();
    if (!roles.includes(req.user.role)) {
      return fail(res, 403, "FORBIDDEN", "Insufficient permissions");
    }
    return next();
  };
}

export async function hydrateUser(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return fail(res, 401, "UNAUTHORIZED", "Authentication required");
  const user = await User.findById(req.user.id);
  if (!user) return fail(res, 401, "UNAUTHORIZED", "User no longer exists");
  req.user.role = user.role;
  req.user.name = user.name;
  req.user.email = user.email;
  next();
}
