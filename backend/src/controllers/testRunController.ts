import type { Request, Response } from "express";
import { testRunService } from "../services/testRunService.js";
import { eventBus } from "../events/eventBus.js";
import { listTimeline } from "../services/eventService.js";
import { ok, created, paginated } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { routeParam } from "../utils/params.js";
import { parsePagination } from "../utils/pagination.js";
import { TestRun } from "../models/TestRun.js";
import { notFound } from "../utils/AppError.js";
import { Project } from "../models/Project.js";

async function assertRunAccess(req: Request, testRunId: string) {
  const run = await TestRun.findById(testRunId);
  if (!run) throw notFound("Test run not found");
  if (req.user?.role === "admin") return run;
  const project = await Project.findOne({
    _id: run.projectId,
    $or: [{ ownerId: req.user!.id }, { "members.userId": req.user!.id }],
  });
  if (!project) throw notFound("Test run not found");
  return run;
}

export const testRunController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const data = await testRunService.start(routeParam(req, "projectId"), req.user!.id, {
      watchBrowser: Boolean(req.body?.watchBrowser),
      environment: typeof req.body?.environment === "string" ? req.body.environment : undefined,
      captureScreenshots:
        typeof req.body?.captureScreenshots === "boolean" ? req.body.captureScreenshots : undefined,
      focusMode: req.body?.focusMode,
      focusPages: Array.isArray(req.body?.focusPages) ? req.body.focusPages : undefined,
      instructions: typeof req.body?.instructions === "string" ? req.body.instructions : undefined,
      customCases: Array.isArray(req.body?.customCases) ? req.body.customCases : undefined,
    });
    return created(res, data);
  }),
  list: asyncHandler(async (req: Request, res: Response) => {
    const items = await testRunService.listForProject(routeParam(req, "projectId"));
    const { page, limit } = parsePagination(req.query as Record<string, unknown>);
    return paginated(res, items.slice((page - 1) * limit, page * limit), page, limit, items.length);
  }),
  get: asyncHandler(async (req: Request, res: Response) => {
    await assertRunAccess(req, routeParam(req, "testRunId"));
    return ok(res, await testRunService.get(routeParam(req, "testRunId")));
  }),
  cancel: asyncHandler(async (req: Request, res: Response) => {
    await assertRunAccess(req, routeParam(req, "testRunId"));
    return ok(res, await testRunService.cancel(routeParam(req, "testRunId"), req.user!.id));
  }),
  retry: asyncHandler(async (req: Request, res: Response) => {
    await assertRunAccess(req, routeParam(req, "testRunId"));
    return ok(res, await testRunService.retry(routeParam(req, "testRunId"), req.user!.id));
  }),
  cases: asyncHandler(async (req: Request, res: Response) => {
    await assertRunAccess(req, routeParam(req, "testRunId"));
    return ok(res, await testRunService.listCases(routeParam(req, "testRunId")));
  }),
  results: asyncHandler(async (req: Request, res: Response) => {
    await assertRunAccess(req, routeParam(req, "testRunId"));
    return ok(res, await testRunService.listResults(routeParam(req, "testRunId")));
  }),
  bugs: asyncHandler(async (req: Request, res: Response) => {
    await assertRunAccess(req, routeParam(req, "testRunId"));
    return ok(res, await testRunService.listBugs(routeParam(req, "testRunId")));
  }),
  events: asyncHandler(async (req: Request, res: Response) => {
    await assertRunAccess(req, routeParam(req, "testRunId"));
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const history = await listTimeline(routeParam(req, "testRunId"));
    for (const event of history) {
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    }

    const unsubscribe = eventBus.subscribe(routeParam(req, "testRunId"), (event) => {
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    });

    const heartbeat = setInterval(() => {
      res.write(`event: ping\ndata: {}\n\n`);
    }, 15000);

    req.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  }),
};
