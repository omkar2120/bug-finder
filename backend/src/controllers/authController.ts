import type { Request, Response } from "express";
import { authService } from "../services/authService.js";
import { ok } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { loadEnv } from "../config/env.js";

function setRefreshCookie(res: Response, token: string) {
  const env = loadEnv();
  res.cookie("refreshToken", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/api/v1/auth",
  });
}

export const authController = {
  register: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.register(req.body);
    setRefreshCookie(res, result.refreshToken);
    return ok(res, result, undefined, 201);
  }),
  login: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.login({
      ...req.body,
      userAgent: req.get("user-agent") ?? undefined,
      ip: req.ip,
    });
    setRefreshCookie(res, result.refreshToken);
    return ok(res, result);
  }),
  refresh: asyncHandler(async (req: Request, res: Response) => {
    const token = req.body.refreshToken || req.cookies.refreshToken;
    const result = await authService.refresh(token, req.get("user-agent") ?? undefined, req.ip);
    setRefreshCookie(res, result.refreshToken);
    return ok(res, result);
  }),
  logout: asyncHandler(async (req: Request, res: Response) => {
    await authService.logout(req.body.refreshToken || req.cookies.refreshToken);
    res.clearCookie("refreshToken", { path: "/api/v1/auth" });
    return ok(res, { success: true });
  }),
  me: asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.me(req.user!.id);
    return ok(res, user);
  }),
  forgotPassword: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.forgotPassword(req.body.email);
    return ok(res, result);
  }),
  resetPassword: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.resetPassword(req.body.token, req.body.password);
    return ok(res, result);
  }),
};
