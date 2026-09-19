import type { Request, Response } from "express";
import { projectService } from "../services/projectService.js";
import { dashboardService } from "../services/dashboardService.js";
import { ok, created, paginated } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { routeParam } from "../utils/params.js";
import { parsePagination } from "../utils/pagination.js";

export const projectController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const items = await projectService.listForUser(req.user!.id, req.user!.role, req.query.status as string | undefined);
    const { page, limit } = parsePagination(req.query as Record<string, unknown>);
    const start = (page - 1) * limit;
    return paginated(res, items.slice(start, start + limit), page, limit, items.length);
  }),
  create: asyncHandler(async (req: Request, res: Response) => {
    const project = await projectService.create(req.user!.id, req.body);
    return created(res, project);
  }),
  get: asyncHandler(async (req: Request, res: Response) => {
    const project = await projectService.getById(routeParam(req, "projectId"));
    return ok(res, project);
  }),
  update: asyncHandler(async (req: Request, res: Response) => {
    const project = await projectService.update(routeParam(req, "projectId"), req.user!.id, req.body);
    return ok(res, project);
  }),
  archive: asyncHandler(async (req: Request, res: Response) => {
    const project = await projectService.archive(routeParam(req, "projectId"), req.user!.id);
    return ok(res, project);
  }),
  dashboard: asyncHandler(async (req: Request, res: Response) => {
    const data = await dashboardService.projectDashboard(routeParam(req, "projectId"));
    return ok(res, data);
  }),
};
