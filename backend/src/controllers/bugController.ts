import type { Request, Response } from "express";
import { bugService } from "../services/bugService.js";
import { Bug } from "../models/Bug.js";
import { Project } from "../models/Project.js";
import { ok, paginated } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { routeParam } from "../utils/params.js";
import { parsePagination } from "../utils/pagination.js";
import { notFound } from "../utils/AppError.js";

async function assertBugAccess(req: Request, bugId: string) {
  const bug = await Bug.findById(bugId);
  if (!bug) throw notFound("Bug not found");
  if (req.user?.role === "admin") return bug;
  const project = await Project.findOne({
    _id: bug.projectId,
    $or: [{ ownerId: req.user!.id }, { "members.userId": req.user!.id }],
  });
  if (!project) throw notFound("Bug not found");
  return bug;
}

export const bugController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const items = await bugService.list(routeParam(req, "projectId"), {
      status: req.query.status as string | undefined,
      severity: req.query.severity as string | undefined,
    });
    const { page, limit } = parsePagination(req.query as Record<string, unknown>);
    return paginated(res, items.slice((page - 1) * limit, page * limit), page, limit, items.length);
  }),
  get: asyncHandler(async (req: Request, res: Response) => {
    await assertBugAccess(req, routeParam(req, "bugId"));
    return ok(res, await bugService.get(routeParam(req, "bugId")));
  }),
  update: asyncHandler(async (req: Request, res: Response) => {
    await assertBugAccess(req, routeParam(req, "bugId"));
    return ok(res, await bugService.update(routeParam(req, "bugId"), req.body));
  }),
};
