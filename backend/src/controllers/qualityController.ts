import type { Request, Response } from "express";
import { ApiRequest } from "../models/ApiRequest.js";
import { ContentIssue } from "../models/ContentIssue.js";
import { AccessibilityIssue } from "../models/AccessibilityIssue.js";
import { PerformanceMetric } from "../models/PerformanceMetric.js";
import { Screenshot } from "../models/Screenshot.js";
import { ConsoleLog } from "../models/ConsoleLog.js";
import { TestRun } from "../models/TestRun.js";
import { Project } from "../models/Project.js";
import { reportService } from "../services/reportService.js";
import { dashboardService } from "../services/dashboardService.js";
import { getStorage } from "../services/storageService.js";
import { ok, created, paginated } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { routeParam } from "../utils/params.js";
import { parsePagination } from "../utils/pagination.js";
import { notFound } from "../utils/AppError.js";

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

export const qualityController = {
  globalDashboard: asyncHandler(async (req: Request, res: Response) => {
    return ok(res, await dashboardService.global(req.user!.id, req.user!.role));
  }),
  apiRequests: asyncHandler(async (req: Request, res: Response) => {
    await assertRunAccess(req, routeParam(req, "testRunId"));
    const query: Record<string, unknown> = { testRunId: routeParam(req, "testRunId") };
    const statusClass = req.query.statusClass as string | undefined;
    const method = req.query.method as string | undefined;
    if (method) query.method = method;
    if (statusClass === "2xx") query["response.status"] = { $gte: 200, $lt: 300 };
    if (statusClass === "3xx") query["response.status"] = { $gte: 300, $lt: 400 };
    if (statusClass === "4xx") query["response.status"] = { $gte: 400, $lt: 500 };
    if (statusClass === "5xx") query["response.status"] = { $gte: 500, $lt: 600 };
    if (statusClass === "Failed") query.result = { $ne: "success" };
    if (req.query.slow === "true") query["timing.durationMs"] = { $gte: 1000 };
    const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
    const [items, total] = await Promise.all([
      ApiRequest.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ApiRequest.countDocuments(query),
    ]);
    return paginated(res, items, page, limit, total);
  }),
  apiRequest: asyncHandler(async (req: Request, res: Response) => {
    const item = await ApiRequest.findById(routeParam(req, "requestId")).lean();
    if (!item) throw notFound("API request not found");
    return ok(res, item);
  }),
  contentIssues: asyncHandler(async (req: Request, res: Response) => {
    await assertRunAccess(req, routeParam(req, "testRunId"));
    return ok(res, await ContentIssue.find({ testRunId: routeParam(req, "testRunId") }).sort({ createdAt: -1 }).lean());
  }),
  accessibilityIssues: asyncHandler(async (req: Request, res: Response) => {
    await assertRunAccess(req, routeParam(req, "testRunId"));
    return ok(res, await AccessibilityIssue.find({ testRunId: routeParam(req, "testRunId") }).sort({ createdAt: -1 }).lean());
  }),
  performance: asyncHandler(async (req: Request, res: Response) => {
    await assertRunAccess(req, routeParam(req, "testRunId"));
    const metrics = await PerformanceMetric.find({ testRunId: routeParam(req, "testRunId") }).lean();
    const apis = await ApiRequest.find({ testRunId: routeParam(req, "testRunId") }).lean();
    return ok(res, {
      pages: metrics,
      avgLoadMs: metrics.length ? Math.round(metrics.reduce((s, m) => s + (m.loadMs ?? 0), 0) / metrics.length) : 0,
      avgApiMs: apis.length ? Math.round(apis.reduce((s, a) => s + (a.timing?.durationMs ?? 0), 0) / apis.length) : 0,
      slowestPages: [...metrics].sort((a, b) => (b.loadMs ?? 0) - (a.loadMs ?? 0)).slice(0, 5),
      slowestApis: [...apis].sort((a, b) => (b.timing?.durationMs ?? 0) - (a.timing?.durationMs ?? 0)).slice(0, 5),
      failedRequests: apis.filter((a) => a.result !== "success").length,
    });
  }),
  projectContent: asyncHandler(async (req: Request, res: Response) => {
    return ok(res, await ContentIssue.find({ projectId: routeParam(req, "projectId") }).sort({ createdAt: -1 }).limit(100).lean());
  }),
  projectAccessibility: asyncHandler(async (req: Request, res: Response) => {
    return ok(res, await AccessibilityIssue.find({ projectId: routeParam(req, "projectId") }).sort({ createdAt: -1 }).limit(100).lean());
  }),
  projectPerformance: asyncHandler(async (req: Request, res: Response) => {
    const metrics = await PerformanceMetric.find({ projectId: routeParam(req, "projectId") }).sort({ createdAt: -1 }).limit(100).lean();
    const apis = await ApiRequest.find({ projectId: routeParam(req, "projectId") }).sort({ createdAt: -1 }).limit(100).lean();
    return ok(res, { metrics, apis });
  }),
  projectApis: asyncHandler(async (req: Request, res: Response) => {
    const items = await ApiRequest.find({ projectId: routeParam(req, "projectId") }).sort({ createdAt: -1 }).limit(200).lean();
    return ok(res, items);
  }),
  reports: asyncHandler(async (req: Request, res: Response) => {
    return ok(res, await reportService.list(routeParam(req, "projectId")));
  }),
  createReport: asyncHandler(async (req: Request, res: Response) => {
    return created(res, await reportService.create(routeParam(req, "projectId"), req.user!.id, req.body));
  }),
  downloadReport: asyncHandler(async (req: Request, res: Response) => {
    const { report, buffer } = await reportService.getFile(routeParam(req, "reportId"));
    res.setHeader("Content-Type", report.format === "json" ? "application/json" : "text/html");
    return res.send(buffer);
  }),
  screenshot: asyncHandler(async (req: Request, res: Response) => {
    const shot = await Screenshot.findById(routeParam(req, "screenshotId"));
    if (!shot) throw notFound("Screenshot not found");
    const buffer = await getStorage().get(shot.storage.key);
    res.setHeader("Content-Type", "image/png");
    return res.send(buffer);
  }),
  screenshots: asyncHandler(async (req: Request, res: Response) => {
    await assertRunAccess(req, routeParam(req, "testRunId"));
    const items = await Screenshot.find({ testRunId: routeParam(req, "testRunId") })
      .select("metadata testResultId createdAt")
      .sort({ createdAt: 1 })
      .lean();
    return ok(res, items);
  }),
  consoleLogs: asyncHandler(async (req: Request, res: Response) => {
    await assertRunAccess(req, routeParam(req, "testRunId"));
    return ok(res, await ConsoleLog.find({ testRunId: routeParam(req, "testRunId") }).sort({ createdAt: -1 }).limit(200).lean());
  }),
};
