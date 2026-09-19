import mongoose from "mongoose";
import {
  discoverApplication,
  executeTest,
  BrowserSession,
  collectAccessibilityIssues,
  isAllowedUrl,
  showLiveHud,
} from "@bugpilot/automation";
import type { DiscoveredPage, CapturedApi } from "@bugpilot/automation";
import { TestRun } from "../models/TestRun.js";
import { TestCase } from "../models/TestCase.js";
import { TestResult } from "../models/TestResult.js";
import { Project } from "../models/Project.js";
import { ProjectSecret } from "../models/ProjectSecret.js";
import { Screenshot } from "../models/Screenshot.js";
import { ApiRequest } from "../models/ApiRequest.js";
import { ConsoleLog } from "../models/ConsoleLog.js";
import { ContentIssue } from "../models/ContentIssue.js";
import { AccessibilityIssue } from "../models/AccessibilityIssue.js";
import { PerformanceMetric } from "../models/PerformanceMetric.js";
import { Bug } from "../models/Bug.js";
import { decryptSecret } from "../utils/crypto.js";
import { getStorage } from "../services/storageService.js";
import { emitRunEvent } from "../services/eventService.js";
import { generateTests, analyzeBug, analyzeContent, detectDuplicates, analyzeRisk } from "../services/aiClient.js";
import { bugService } from "../services/bugService.js";
import { calculateHealthScore } from "../services/healthScoreService.js";
import { logger } from "../utils/logger.js";
import { loadEnv } from "../config/env.js";
import { resolveRunTarget } from "../services/domainService.js";

async function isCancelled(testRunId: string) {
  const run = await TestRun.findById(testRunId).select("cancelRequested status");
  return Boolean(run?.cancelRequested || run?.status === "cancelled");
}

async function setStatus(testRunId: string, status: string, activity?: string, extra?: Record<string, unknown>) {
  await TestRun.findByIdAndUpdate(testRunId, {
    status,
    ...(activity ? { currentActivity: activity } : {}),
    ...extra,
  });
}

async function storeScreenshot(input: {
  projectId: string;
  testRunId: string;
  buffer?: Buffer;
  pageUrl?: string;
  testResultId?: string;
}) {
  if (!input.buffer) return undefined;
  const key = `screenshots/${input.projectId}/${input.testRunId}/${new mongoose.Types.ObjectId().toString()}.png`;
  const stored = await getStorage().put(key, input.buffer, "image/png");
  const doc = await Screenshot.create({
    projectId: input.projectId,
    testRunId: input.testRunId,
    testResultId: input.testResultId,
    storage: stored,
    metadata: { width: 1440, height: 900, pageUrl: input.pageUrl },
  });
  return doc._id;
}

function analyzeApiHeuristically(api: CapturedApi) {
  const status = api.responseStatus ?? 0;
  if (status >= 500) {
    return {
      suspicious: true,
      confidence: 0.9,
      issue: `${api.method} ${api.endpoint} returned ${status}. Server errors after a user action are often application bugs.`,
    };
  }
  if (status === 401 || status === 403) {
    return {
      suspicious: true,
      confidence: 0.7,
      issue: `${api.method} ${api.endpoint} returned ${status}. Review whether this authentication/authorization outcome is expected.`,
    };
  }
  if (api.durationMs > 2000) {
    return {
      suspicious: true,
      confidence: 0.65,
      issue: `${api.method} ${api.endpoint} took ${api.durationMs}ms.`,
    };
  }
  return { suspicious: false };
}

export async function processTestRun(testRunId: string) {
  const run = await TestRun.findOneAndUpdate(
    { _id: testRunId, status: "queued" },
    {
      $set: {
        status: "discovering",
        startedAt: new Date(),
        currentActivity: "Opening authorized application",
      },
    },
    { new: true },
  );
  if (!run) {
    logger.info("Test run already claimed or not queued", { testRunId });
    return;
  }
  const project = await Project.findById(run.projectId);
  if (!project) throw new Error("Project not found");

  const projectId = String(project._id);
  const target = resolveRunTarget(project.application, run.configuration.environment);
  const startUrl = run.configuration.baseUrl || target.baseUrl;
  const allowedDomains = target.allowedDomains;
  const captureScreenshots = run.configuration.captureScreenshots === true;
  if (!startUrl || !isAllowedUrl(startUrl, allowedDomains)) {
    throw new Error("Application URL is not in the authorized domain list");
  }

  await emitRunEvent({
    type: "TEST_RUN_STARTED",
    testRunId,
    projectId,
    message: "AI testing started",
    level: "success",
  });

  let session: BrowserSession | undefined;
  try {
    if (await isCancelled(testRunId)) {
      await finalizeCancelled(testRunId, projectId);
      return;
    }

    const secrets = await ProjectSecret.findOne({ projectId });
    let credentials: { username: string; password: string } | undefined;
    if (secrets?.login?.usernameEncrypted && secrets.login.passwordEncrypted) {
      credentials = {
        username: decryptSecret(secrets.login.usernameEncrypted),
        password: decryptSecret(secrets.login.passwordEncrypted),
      };
    }

    const brief = (run.brief ?? {}) as {
      focusMode?: string;
      focusPages?: string[];
      instructions?: string;
      customCases?: string[];
    };
    const seedUrls = (brief.focusPages ?? [])
      .map((page) => {
        try {
          return new URL(page, startUrl).toString();
        } catch {
          return "";
        }
      })
      .filter((url) => url && isAllowedUrl(url, allowedDomains));
    const focusedCrawl = brief.focusMode === "page" || brief.focusMode === "validation" || seedUrls.length > 0;

    const headed = run.configuration.headless === false;
    session = new BrowserSession({
      browser: run.configuration.browser as "chromium" | "firefox" | "webkit",
      headless: !headed,
      allowedDomains,
    });
    await session.start();
    const page = await session.newPage();

    if (headed) {
      await emitRunEvent({
        type: "ACTIVITY",
        testRunId,
        projectId,
        message: "Chrome stays open for the whole run. A label in the window shows each step.",
        level: "info",
      });
      await TestRun.findByIdAndUpdate(testRunId, {
        currentActivity: "Opening Chrome — one window for the whole test",
        currentStep: "Launching browser",
      });
      await showLiveHud(page, "BugPilot is starting. This Chrome window stays open.");
    }

    let discovered;
    try {
    discovered = await discoverApplication({
      startUrl: seedUrls[0] || startUrl,
      seedUrls,
      followLinks: !focusedCrawl || brief.focusMode === "flow",
      allowedDomains,
      maxPages: run.configuration.maxPages,
      maxDepth: run.configuration.maxDepth,
      maxDurationSeconds: run.configuration.maxDurationSeconds,
      browser: run.configuration.browser as "chromium" | "firefox" | "webkit",
      headless: !headed,
      headed,
      captureScreenshots,
      session,
      page,
      keepOpen: true,
      credentials,
      shouldStop: () => isCancelled(testRunId),
      onPage: async (found) => {
        await TestRun.findByIdAndUpdate(testRunId, {
          currentPage: found.url,
          currentActivity: `Looking at ${found.title || found.url}`,
          currentStep: `Discovering ${found.url}`,
          $inc: { "statistics.pagesDiscovered": 1 },
        });
        await emitRunEvent({
          type: "PAGE_DISCOVERED",
          testRunId,
          projectId,
          message: `Now looking at: ${found.title || found.url}`,
          level: "success",
          payload: { url: found.url, title: found.title },
        });
        if (captureScreenshots) {
          await storeScreenshot({
            projectId,
            testRunId,
            buffer: found.screenshot,
            pageUrl: found.url,
          });
        }
      },
    });
    } catch (error) {
      await session.close();
      throw error;
    }

    if (await isCancelled(testRunId)) {
      await session.close();
      await finalizeCancelled(testRunId, projectId);
      return;
    }

    for (const api of discovered.apis) {
      await persistApi(projectId, testRunId, api);
    }

    if (headed) {
      await showLiveHud(page, "I finished looking at the pages. Now I am writing the tests…");
      await TestRun.findByIdAndUpdate(testRunId, {
        currentActivity: "Writing tests from the pages just opened",
        currentStep: "Generating tests — Chrome stays open",
      });
    }

    await setStatus(testRunId, "generating_tests", "AI is generating structured tests");
    await emitRunEvent({
      type: "AI_ANALYSIS_STARTED",
      testRunId,
      projectId,
      message: brief.instructions || brief.customCases?.length
        ? "AI is writing tests from your pages, validations, and flows"
        : "AI generating tests from discovered application",
      level: "ai",
    });

    let generated;
    try {
    generated = await generateTests({
      projectId,
      testRunId,
      applicationContext: {
        pages: discovered.pages.map((p) => ({
          url: p.url,
          title: p.title,
          elements: p.elements.slice(0, 40),
        })),
        apis: discovered.apis.map((a) => ({
          method: a.method,
          endpoint: a.endpoint,
          status: a.responseStatus,
        })),
      },
      requirements: [
        ...project.requirements.map((r) => ({ text: r.text, priority: r.priority })),
        ...(brief.instructions ? [{ text: brief.instructions, priority: "high" as const }] : []),
        ...(brief.customCases ?? []).map((text) => ({ text, priority: "high" as const })),
      ],
      brief: {
        focusMode: brief.focusMode ?? "full",
        focusPages: seedUrls.length ? seedUrls : brief.focusPages ?? [],
        instructions: brief.instructions ?? "",
        customCases: brief.customCases ?? [],
      },
      limits: { maxTests: brief.focusMode === "full" && !brief.customCases?.length ? 40 : 24 },
    });
    } catch (error) {
      await session.close();
      throw error;
    }

    const testDocs = [];
    for (const test of generated.tests as Array<Record<string, unknown>>) {
      const doc = await TestCase.create({
        projectId,
        testRunId,
        name: test.name,
        description: test.description,
        type: test.type,
        priority: test.priority ?? "medium",
        preconditions: test.preconditions ?? [],
        steps: test.steps ?? [],
        expectedResult: test.expectedResult,
        generatedBy: "ai",
        aiMetadata: {
          model: generated.model ?? loadEnv().AI_MODEL,
          confidence: test.confidence ?? 0.7,
          reasoningSummary: test.description,
        },
      });
      testDocs.push(doc);
      await emitRunEvent({
        type: "TEST_GENERATED",
        testRunId,
        projectId,
        message: `Test generated: ${doc.name}`,
        level: "success",
        payload: { testCaseId: String(doc._id), type: doc.type },
      });
    }

    await TestRun.findByIdAndUpdate(testRunId, {
      "statistics.testsGenerated": testDocs.length,
      status: "running",
      currentActivity: "Playwright is executing generated tests",
    });

    if (!testDocs.length) {
      await session.close();
    }

    const apiOffset = session.apis.length;
    const logOffset = session.consoleLogs.length;

    try {
      for (const testDoc of testDocs) {
        if (await isCancelled(testRunId)) break;
        await TestRun.findByIdAndUpdate(testRunId, {
          currentActivity: `Now testing: ${testDoc.name}`,
          currentTestName: testDoc.name,
          currentStep: `Starting ${testDoc.name}`,
          currentPage: page.url() || startUrl,
        });
        if (headed) await showLiveHud(page, `Now testing: ${testDoc.name}`);
        await emitRunEvent({
          type: "TEST_STARTED",
          testRunId,
          projectId,
          message: `Now testing: ${testDoc.name}`,
          payload: { testCaseId: String(testDoc._id) },
        });

        const startedAt = new Date();
        const result = await executeTest(
          page,
          {
            name: testDoc.name,
            steps: testDoc.steps as never,
            expectedResult: testDoc.expectedResult,
          },
          allowedDomains,
          {
            headed,
            captureScreenshots,
            onStep: async ({ label, index, total, pageUrl }) => {
              const stepText = `Step ${index + 1}/${total}: ${label}`;
              await TestRun.findByIdAndUpdate(testRunId, {
                currentActivity: `${testDoc.name} — ${label}`,
                currentTestName: testDoc.name,
                currentStep: stepText,
                currentPage: pageUrl || page.url(),
              });
              await emitRunEvent({
                type: "ACTIVITY",
                testRunId,
                projectId,
                message: `${testDoc.name}: ${stepText}`,
                level: "info",
              });
            },
          },
        );
        const keepShot = captureScreenshots || result.status !== "passed";
        const screenshotId = keepShot
          ? await storeScreenshot({
              projectId,
              testRunId,
              buffer: result.screenshot,
              pageUrl: result.pageUrl,
            })
          : undefined;

        const testResult = await TestResult.create({
          projectId,
          testRunId,
          testCaseId: testDoc._id,
          status: result.status,
          startedAt,
          completedAt: new Date(),
          durationMs: result.durationMs,
          actualResult: result.actualResult,
          error: result.error,
          evidence: { screenshotIds: screenshotId ? [screenshotId] : [], apiRequestIds: [], consoleLogIds: [] },
          pageUrl: result.pageUrl,
        });

        await TestRun.findByIdAndUpdate(testRunId, {
          currentPage: result.pageUrl || startUrl,
          currentTestName: testDoc.name,
          $inc: {
            "statistics.testsExecuted": 1,
            [`statistics.${result.status === "passed" ? "passed" : result.status === "failed" ? "failed" : "skipped"}`]: 1,
          },
        });

        await emitRunEvent({
          type: result.status === "passed" ? "TEST_PASSED" : "TEST_FAILED",
          testRunId,
          projectId,
          message: result.status === "passed" ? `${testDoc.name} passed` : `${testDoc.name} failed`,
          level: result.status === "passed" ? "success" : "warning",
          payload: { testResultId: String(testResult._id) },
        });
      }
      if (headed) {
        await showLiveHud(page, "Done. Closing Chrome.");
        await TestRun.findByIdAndUpdate(testRunId, { currentStep: "Closing Chrome" });
      }
    } finally {
      for (const api of session.apis.slice(apiOffset)) await persistApi(projectId, testRunId, api);
      for (const log of session.consoleLogs.slice(logOffset)) {
        await ConsoleLog.create({
          projectId,
          testRunId,
          pageUrl: log.pageUrl,
          level: ["error", "warning", "info", "debug"].includes(log.level) ? log.level : "log",
          message: log.message,
        });
      }
      await session.close();
    }

    if (await isCancelled(testRunId)) {
      await finalizeCancelled(testRunId, projectId);
      return;
    }

    await setStatus(testRunId, "analyzing", "AI is investigating failures and quality signals");
    await emitRunEvent({
      type: "AI_ANALYSIS_STARTED",
      testRunId,
      projectId,
      message: "AI investigating failures and quality issues",
      level: "ai",
    });

    await analyzeFailures(projectId, testRunId, discovered.pages);
    await analyzeQuality(projectId, testRunId, discovered.pages);
    await groupDuplicates(projectId, testRunId);

    const latest = await TestRun.findById(testRunId);
    const stats = latest?.statistics;
    const health = calculateHealthScore({
      criticalBugs: stats?.criticalBugs ?? 0,
      highBugs: stats?.highBugs ?? 0,
      apiFailures: stats?.apiFailures ?? 0,
      accessibilityIssues: stats?.accessibilityIssues ?? 0,
      contentIssues: stats?.contentIssues ?? 0,
      performanceWarnings: stats?.performanceWarnings ?? 0,
      testsExecuted: stats?.testsExecuted ?? 0,
      passed: stats?.passed ?? 0,
    });

    await analyzeRisk({
      projectId,
      testRunId,
      statistics: stats,
    }).catch(() => undefined);

    await TestRun.findByIdAndUpdate(testRunId, {
      status: "completed",
      completedAt: new Date(),
      currentActivity: "AI testing complete",
      healthScore: health.score,
      healthReasons: health.reasons,
    });

    await emitRunEvent({
      type: "AI_ANALYSIS_COMPLETED",
      testRunId,
      projectId,
      message: "AI analysis completed",
      level: "ai",
    });
    await emitRunEvent({
      type: "TEST_RUN_COMPLETED",
      testRunId,
      projectId,
      message: "Test run completed",
      level: "success",
      payload: { healthScore: health.score },
    });
  } catch (error) {
    logger.error("Test run failed", {
      testRunId,
      message: error instanceof Error ? error.message : String(error),
    });
    await TestRun.findByIdAndUpdate(testRunId, {
      status: "failed",
      completedAt: new Date(),
      currentActivity: "Test run failed",
      error: {
        code: "TEST_RUN_FAILED",
        message: error instanceof Error ? error.message : "Unexpected worker error",
      },
    });
    await emitRunEvent({
      type: "TEST_RUN_FAILED",
      testRunId,
      projectId,
      message: error instanceof Error ? error.message : "Test run failed",
      level: "error",
    });
  } finally {
    await session?.close();
  }
}

async function persistApi(projectId: string, testRunId: string, api: CapturedApi) {
  const analysis = analyzeApiHeuristically(api);
  await ApiRequest.create({
    projectId,
    testRunId,
    timestamp: new Date(),
    method: api.method,
    url: api.url,
    endpoint: api.endpoint,
    request: { headers: api.requestHeaders, body: api.requestBody },
    response: {
      status: api.responseStatus,
      statusText: api.responseStatusText,
      headers: api.responseHeaders,
      body: api.responseBody,
      sizeBytes: api.sizeBytes,
    },
    timing: { durationMs: api.durationMs, ttfbMs: api.ttfbMs },
    result: api.result,
    pageUrl: api.pageUrl,
    aiAnalysis: analysis,
  });
  await TestRun.findByIdAndUpdate(testRunId, {
    $inc: {
      "statistics.apiRequests": 1,
      ...(api.result !== "success" ? { "statistics.apiFailures": 1 } : {}),
    },
  });
  await emitRunEvent({
    type: "API_CAPTURED",
    testRunId,
    projectId,
    message: `${api.method} ${api.endpoint} → ${api.responseStatus ?? "network"}`,
    level: api.result === "success" ? "info" : "warning",
  });
}

async function analyzeFailures(projectId: string, testRunId: string, pages: DiscoveredPage[]) {
  const failed = await TestResult.find({ testRunId, status: "failed" });
  for (const result of failed) {
    const test = await TestCase.findById(result.testCaseId);
    const relatedApis = await ApiRequest.find({ testRunId, pageUrl: result.pageUrl }).limit(8).lean();
    const consoleErrors = await ConsoleLog.find({ testRunId, level: "error" }).limit(10).lean();

    let analysis: Record<string, unknown>;
    try {
      analysis = await analyzeBug({
        projectId,
        testRunId,
        test: test?.toObject(),
        result: result.toObject(),
        page: pages.find((p) => p.url === result.pageUrl) ?? { url: result.pageUrl },
        apiEvidence: relatedApis.map((a) => ({
          method: a.method,
          endpoint: a.endpoint,
          status: a.response.status,
          result: a.result,
        })),
        consoleErrors: consoleErrors.map((c) => c.message),
        screenshotReferences: result.evidence.screenshotIds,
      });
    } catch {
      analysis = heuristicFailureClassification(result.error?.message ?? result.actualResult ?? "");
    }

    const classification = classifyFromAnalysis(analysis, result);
    result.classification = classification;
    await result.save();

    if (analysis.isBug && Number(analysis.confidence ?? 0) >= 0.7 && classification === "application_bug") {
      const key = await bugService.nextBugKey(projectId);
      const severity = (analysis.severity as string) || "medium";
      const bug = await Bug.create({
        projectId,
        testRunId,
        bugKey: key,
        title: analysis.title ?? test?.name ?? "Confirmed application defect",
        description: analysis.rootCause ?? result.actualResult ?? "AI confirmed an application defect.",
        category: analysis.category ?? "functional",
        severity,
        priority: severity === "critical" ? "P0" : severity === "high" ? "P1" : severity === "medium" ? "P2" : "P3",
        status: "new",
        confidence: analysis.confidence ?? 0.75,
        page: { url: result.pageUrl ?? pages[0]?.url ?? "", title: pages.find((p) => p.url === result.pageUrl)?.title },
        reproduction: {
          steps: analysis.reproductionSteps ?? test?.steps.map((s) => `${s.action} ${s.target ?? ""} ${s.value ?? ""}`) ?? [],
          expected: analysis.expected ?? test?.expectedResult ?? "",
          actual: analysis.actual ?? result.actualResult ?? "",
        },
        rootCause: analysis.rootCause,
        relatedTests: [result.testCaseId],
        relatedApiRequests: relatedApis.map((a) => a._id),
        evidence: {
          screenshotIds: result.evidence.screenshotIds,
          consoleLogIds: consoleErrors.map((c) => c._id),
          apiRequestIds: relatedApis.map((a) => a._id),
        },
        aiAnalysis: {
          model: loadEnv().AI_MODEL,
          summary: String(analysis.rootCause ?? analysis.title ?? "Investigated failure"),
          confidence: Number(analysis.confidence ?? 0.75),
          generatedAt: new Date(),
        },
      });
      await TestRun.findByIdAndUpdate(testRunId, {
        $inc: {
          "statistics.bugs": 1,
          [`statistics.${severity}Bugs`]: 1,
        },
      });
      await emitRunEvent({
        type: "BUG_DETECTED",
        testRunId,
        projectId,
        message: `Bug confirmed: ${bug.bugKey} ${bug.title}`,
        level: "error",
        payload: { bugId: String(bug._id), confidence: bug.confidence },
      });
    }
  }

  const suspiciousApis = await ApiRequest.find({
    testRunId,
    "aiAnalysis.suspicious": true,
    result: { $in: ["server_error"] },
  }).limit(10);
  for (const api of suspiciousApis) {
    const existing = await Bug.findOne({
      testRunId,
      category: "api",
      "page.url": api.pageUrl ?? api.url,
      title: new RegExp(api.endpoint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    });
    if (existing) continue;
    const key = await bugService.nextBugKey(projectId);
    await Bug.create({
      projectId,
      testRunId,
      bugKey: key,
      title: `${api.method} ${api.endpoint} returned ${api.response.status}`,
      description: api.aiAnalysis?.issue ?? "API returned an unexpected server error.",
      category: "api",
      severity: "high",
      priority: "P1",
      status: "new",
      confidence: api.aiAnalysis?.confidence ?? 0.86,
      page: { url: api.pageUrl ?? api.url },
      reproduction: {
        steps: [`Trigger ${api.method} ${api.endpoint} from ${api.pageUrl ?? "the application"}`],
        expected: "API should return a controlled 4xx validation or success response.",
        actual: `Received ${api.response.status} ${api.response.statusText ?? ""}`.trim(),
      },
      rootCause: "Backend appears to fail instead of validating the request.",
      relatedApiRequests: [api._id],
      evidence: { screenshotIds: [], consoleLogIds: [], apiRequestIds: [api._id] },
    });
    await TestRun.findByIdAndUpdate(testRunId, { $inc: { "statistics.bugs": 1, "statistics.highBugs": 1 } });
  }
}

function heuristicFailureClassification(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("net::") || lower.includes("timeout") || lower.includes("ns_error")) {
    return { isBug: false, confidence: 0.8, category: "other", title: "Environment or network issue", expected: "Page available", actual: message, rootCause: "Network or environment instability." };
  }
  if (lower.includes("unauthorized domain") || lower.includes("blocked navigation")) {
    return { isBug: false, confidence: 0.99, category: "other", title: "Domain restriction", expected: "Stay in authorized domains", actual: message };
  }
  return {
    isBug: true,
    confidence: 0.78,
    severity: "medium",
    category: "functional",
    title: "Unexpected application failure",
    expected: "The user action should complete successfully",
    actual: message,
    rootCause: "The application did not meet the expected result after a real user action.",
    reproductionSteps: [],
  };
}

function classifyFromAnalysis(analysis: Record<string, unknown>, result: { error?: { message?: string } | null }) {
  const message = `${analysis.rootCause ?? ""} ${result.error?.message ?? ""}`.toLowerCase();
  if (message.includes("timeout") || message.includes("net::")) return "network_issue" as const;
  if (message.includes("environment")) return "environment_issue" as const;
  if (analysis.isBug) return "application_bug" as const;
  return "false_positive" as const;
}

async function analyzeQuality(projectId: string, testRunId: string, pages: DiscoveredPage[]) {
  for (const page of pages) {
    try {
      const content = await analyzeContent({
        projectId,
        testRunId,
        pageUrl: page.url,
        elements: page.textSamples,
      });
      for (const issue of content.issues as Array<Record<string, unknown>>) {
        await ContentIssue.create({
          projectId,
          testRunId,
          pageUrl: page.url,
          type: issue.type,
          currentText: issue.currentText,
          suggestedText: issue.suggestedText,
          element: { selector: issue.selector as string | undefined, tag: issue.tag as string | undefined },
          severity: issue.severity ?? "low",
          confidence: issue.confidence ?? 0.7,
          aiAnalysis: { model: content.model, explanation: issue.explanation as string | undefined },
        });
        await TestRun.findByIdAndUpdate(testRunId, { $inc: { "statistics.contentIssues": 1 } });
        await emitRunEvent({
          type: "CONTENT_ISSUE_FOUND",
          testRunId,
          projectId,
          message: `Content issue: ${issue.currentText}`,
          level: "warning",
        });
      }
    } catch (error) {
      logger.warn("Content analysis skipped", { message: error instanceof Error ? error.message : String(error) });
    }

    if (page.performance) {
      const warning = (page.performance.loadMs ?? 0) > 3000 || (page.performance.ttfbMs ?? 0) > 800;
      await PerformanceMetric.create({
        projectId,
        testRunId,
        pageUrl: page.url,
        ...page.performance,
        warning,
        warningReason: warning ? "Slow page load or TTFB" : undefined,
      });
      if (warning) {
        await TestRun.findByIdAndUpdate(testRunId, { $inc: { "statistics.performanceWarnings": 1 } });
        await emitRunEvent({
          type: "PERFORMANCE_ISSUE_FOUND",
          testRunId,
          projectId,
          message: `Slow page: ${page.url}`,
          level: "warning",
        });
      }
    }
  }

  const session = new BrowserSession({ browser: "chromium", headless: true, allowedDomains: [] });
  try {
    await session.start();
    const page = await session.newPage();
    for (const discovered of pages.slice(0, 8)) {
      if (!discovered.url) continue;
      await page.goto(discovered.url, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => undefined);
      const issues = await collectAccessibilityIssues(page);
      for (const issue of issues) {
        await AccessibilityIssue.create({
          projectId,
          testRunId,
          pageUrl: discovered.url,
          ...issue,
        });
        await TestRun.findByIdAndUpdate(testRunId, { $inc: { "statistics.accessibilityIssues": 1 } });
        await emitRunEvent({
          type: "ACCESSIBILITY_ISSUE_FOUND",
          testRunId,
          projectId,
          message: issue.description,
          level: "warning",
        });
      }
    }
  } catch (error) {
    logger.warn("Accessibility scan failed", { message: error instanceof Error ? error.message : String(error) });
  } finally {
    await session.close();
  }
}

async function groupDuplicates(projectId: string, testRunId: string) {
  const bugs = await Bug.find({ testRunId }).lean();
  if (bugs.length < 2) return;
  try {
    const result = await detectDuplicates({
      projectId,
      testRunId,
      bugs: bugs.map((b) => ({
        id: String(b._id),
        title: b.title,
        rootCause: b.rootCause,
        page: b.page.url,
        category: b.category,
      })),
    });
    for (const group of result.groups as Array<{ primaryBugId: string; duplicateBugIds: string[]; confidence: number; reason: string }>) {
      for (const dupId of group.duplicateBugIds) {
        await Bug.findByIdAndUpdate(dupId, {
          status: "duplicate",
          duplicateOf: group.primaryBugId,
        });
      }
    }
  } catch (error) {
    logger.warn("Duplicate detection skipped", { message: error instanceof Error ? error.message : String(error) });
  }
}

async function finalizeCancelled(testRunId: string, projectId: string) {
  await TestRun.findByIdAndUpdate(testRunId, {
    status: "cancelled",
    completedAt: new Date(),
    currentActivity: "Cancelled",
  });
  await emitRunEvent({
    type: "TEST_RUN_CANCELLED",
    testRunId,
    projectId,
    message: "Test run cancelled",
    level: "warning",
  });
}
