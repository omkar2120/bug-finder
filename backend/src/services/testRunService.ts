import { TestRun } from "../models/TestRun.js";
import { TestCase } from "../models/TestCase.js";
import { TestResult } from "../models/TestResult.js";
import { Bug } from "../models/Bug.js";
import { Project } from "../models/Project.js";
import { AuditLog } from "../models/AuditLog.js";
import { notFound, validationError } from "../utils/AppError.js";
import { enqueueTestRun } from "../jobs/queues.js";
import { emitRunEvent, listTimeline } from "./eventService.js";
import { resolveRunTarget } from "./domainService.js";

export class TestRunService {
  async start(
    projectId: string,
    userId: string,
    options?: {
      watchBrowser?: boolean;
      environment?: string;
      captureScreenshots?: boolean;
      focusMode?: "full" | "page" | "validation" | "flow";
      focusPages?: string[];
      instructions?: string;
      customCases?: string[];
    },
  ) {
    const project = await Project.findById(projectId);
    if (!project) throw notFound("Project not found");
    if (project.status === "archived") throw validationError("Archived projects cannot start new test runs");

    const target = resolveRunTarget(project.application, options?.environment);
    if (!target.baseUrl) {
      throw validationError("This environment has no URL. Add PROD, QA, and UAT URLs in project settings.");
    }

    const watchBrowser = Boolean(options?.watchBrowser);
    const captureScreenshots =
      typeof options?.captureScreenshots === "boolean"
        ? options.captureScreenshots
        : Boolean(project.testingConfig.captureScreenshots);
    const allowedModes = ["full", "page", "validation", "flow"] as const;
    const focusMode = allowedModes.includes(options?.focusMode as (typeof allowedModes)[number])
      ? (options!.focusMode as (typeof allowedModes)[number])
      : "full";
    const focusPages = (options?.focusPages ?? []).map((value) => value.trim()).filter(Boolean).slice(0, 20);
    const instructions = String(options?.instructions ?? "").trim().slice(0, 8000);
    const customCases = (options?.customCases ?? []).map((value) => value.trim()).filter(Boolean).slice(0, 40);
    const focused = focusMode !== "full" || focusPages.length > 0 || Boolean(instructions) || customCases.length > 0;

    const run = await TestRun.create({
      projectId,
      triggeredBy: userId,
      status: "queued",
      configuration: {
        browser: project.testingConfig.browser,
        maxPages: focused && focusPages.length ? Math.max(focusPages.length, 1) : project.testingConfig.maxPages,
        maxDepth: focusMode === "page" || focusMode === "validation" ? 0 : focusMode === "flow" ? 1 : project.testingConfig.maxDepth,
        maxDurationSeconds: project.testingConfig.maxDurationSeconds,
        headless: watchBrowser ? false : project.testingConfig.headless !== false,
        environment: target.environment,
        baseUrl: target.baseUrl,
        captureScreenshots,
      },
      brief: {
        focusMode,
        focusPages,
        instructions,
        customCases,
      },
      currentActivity: focused
        ? "Queued — AI will test the pages and flows you described"
        : watchBrowser
          ? "Queued — Chromium will open on this machine so you can watch"
          : "Queued for AI testing",
    });

    await emitRunEvent({
      type: "ACTIVITY",
      testRunId: run.id,
      projectId,
      message: focused
        ? `Queued with your brief: ${focusMode}${focusPages.length ? ` · ${focusPages.length} page(s)` : ""}${customCases.length ? ` · ${customCases.length} case(s)` : ""}`
        : "Added to the AI test queue. Discovery starts next.",
      level: "info",
    });
    await enqueueTestRun(run.id);
    await AuditLog.create({
      actorId: userId,
      action: "test_run.start",
      resourceType: "testRun",
      resourceId: run.id,
    });

    return {
      testRunId: run.id,
      status: run.status,
    };
  }

  async get(testRunId: string) {
    const run = await TestRun.findById(testRunId).lean();
    if (!run) throw notFound("Test run not found");
    const timeline = await listTimeline(testRunId);
    return { ...run, id: String(run._id), timeline };
  }

  async retry(testRunId: string, userId: string) {
    const run = await TestRun.findById(testRunId);
    if (!run) throw notFound("Test run not found");
    if (!["queued", "failed"].includes(run.status)) {
      throw validationError("Only queued or failed runs can be started again");
    }
    if (run.status === "failed") {
      run.status = "queued";
      run.error = undefined;
      run.completedAt = undefined;
      run.cancelRequested = false;
      run.currentActivity = "Queued for AI testing";
      await run.save();
    }
    await emitRunEvent({
      type: "ACTIVITY",
      testRunId: run.id,
      projectId: String(run.projectId),
      message: "Starting the queued AI test now.",
      level: "info",
    });
    await enqueueTestRun(run.id);
    await AuditLog.create({
      actorId: userId,
      action: "test_run.retry",
      resourceType: "testRun",
      resourceId: run.id,
    });
    return { testRunId: run.id, status: run.status };
  }

  async cancel(testRunId: string, userId: string) {
    const run = await TestRun.findById(testRunId);
    if (!run) throw notFound("Test run not found");
    if (["completed", "failed", "cancelled"].includes(run.status)) {
      return { id: run.id, status: run.status };
    }
    run.cancelRequested = true;
    if (run.status === "queued") {
      run.status = "cancelled";
      run.completedAt = new Date();
      run.currentActivity = "Cancelled before start";
    }
    await run.save();
    await AuditLog.create({
      actorId: userId,
      action: "test_run.cancel",
      resourceType: "testRun",
      resourceId: run.id,
    });
    return { id: run.id, status: run.status, cancelRequested: run.cancelRequested };
  }

  async listForProject(projectId: string) {
    return TestRun.find({ projectId }).sort({ createdAt: -1 }).lean();
  }

  async listCases(testRunId: string) {
    return TestCase.find({ testRunId }).sort({ createdAt: 1 }).lean();
  }

  async listResults(testRunId: string) {
    return TestResult.find({ testRunId }).sort({ createdAt: 1 }).lean();
  }

  async listBugs(testRunId: string) {
    return Bug.find({ testRunId }).sort({ createdAt: -1 }).lean();
  }
}

export const testRunService = new TestRunService();
