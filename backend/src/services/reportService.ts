import { Project } from "../models/Project.js";
import { TestRun } from "../models/TestRun.js";
import { TestResult } from "../models/TestResult.js";
import { Bug } from "../models/Bug.js";
import { ApiRequest } from "../models/ApiRequest.js";
import { ContentIssue } from "../models/ContentIssue.js";
import { AccessibilityIssue } from "../models/AccessibilityIssue.js";
import { PerformanceMetric } from "../models/PerformanceMetric.js";
import { Report } from "../models/Report.js";
import { getStorage } from "./storageService.js";
import { dashboardService } from "./dashboardService.js";
import { notFound } from "../utils/AppError.js";

export class ReportService {
  async list(projectId: string) {
    return Report.find({ projectId }).sort({ createdAt: -1 }).lean();
  }

  async create(projectId: string, userId: string, input: { type: string; format: "html" | "json"; testRunId?: string }) {
    const project = await Project.findById(projectId);
    if (!project) throw notFound("Project not found");
    const run = input.testRunId
      ? await TestRun.findById(input.testRunId)
      : await TestRun.findOne({ projectId }).sort({ createdAt: -1 });
    const payload = await this.buildPayload(projectId, run?._id ? String(run._id) : undefined);
    const title = `${input.type.replace("_", " ")} report — ${project.name}`;
    const body =
      input.format === "json" ? JSON.stringify(payload, null, 2) : renderHtmlReport(title, payload);
    const key = `reports/${projectId}/${Date.now()}.${input.format}`;
    const stored = await getStorage().put(key, Buffer.from(body, "utf8"), input.format === "json" ? "application/json" : "text/html");
    const report = await Report.create({
      projectId,
      testRunId: run?._id,
      type: input.type,
      format: input.format,
      title,
      storage: stored,
      generatedBy: userId,
      summary: {
        healthScore: payload.healthScore,
        bugs: payload.bugs.total,
        tests: payload.tests.executed,
      },
    });
    return report.toObject();
  }

  async getFile(reportId: string) {
    const report = await Report.findById(reportId);
    if (!report) throw notFound("Report not found");
    const buffer = await getStorage().get(report.storage.key);
    return { report, buffer };
  }

  private async buildPayload(projectId: string, testRunId?: string) {
    const dashboard = await dashboardService.projectDashboard(projectId);
    const [bugs, results, apis, content, a11y, perf, run] = await Promise.all([
      Bug.find(testRunId ? { testRunId } : { projectId }).sort({ severity: 1 }).lean(),
      TestResult.find(testRunId ? { testRunId } : { projectId }).lean(),
      ApiRequest.find(testRunId ? { testRunId } : { projectId }).lean(),
      ContentIssue.find(testRunId ? { testRunId } : { projectId }).lean(),
      AccessibilityIssue.find(testRunId ? { testRunId } : { projectId }).lean(),
      PerformanceMetric.find(testRunId ? { testRunId } : { projectId }).lean(),
      testRunId ? TestRun.findById(testRunId).lean() : TestRun.findOne({ projectId }).sort({ createdAt: -1 }).lean(),
    ]);
    return {
      generatedAt: new Date().toISOString(),
      application: (await Project.findById(projectId))?.application,
      run,
      tests: dashboard.tests,
      bugs: {
        ...dashboard.bugs,
        criticalItems: bugs.filter((b) => b.severity === "critical"),
        highItems: bugs.filter((b) => b.severity === "high"),
      },
      apis: dashboard.apis,
      content: { total: content.length, items: content.slice(0, 25) },
      accessibility: { total: a11y.length, items: a11y.slice(0, 25) },
      performance: dashboard.performance,
      results: results.slice(0, 50),
      recommendations: buildRecommendations(dashboard),
      healthScore: dashboard.healthScore,
      aiFindings: bugs.slice(0, 10).map((b) => b.aiAnalysis?.summary).filter(Boolean),
    };
  }
}

function buildRecommendations(dashboard: Awaited<ReturnType<typeof dashboardService.projectDashboard>>) {
  const recs: string[] = [];
  if (dashboard.bugs.critical > 0) recs.push("Resolve critical defects before the next release candidate.");
  if (dashboard.apis.serverErrors > 0) recs.push("Investigate 5xx API responses and add defensive validation.");
  if (dashboard.accessibility.total > 0) recs.push("Address accessibility findings, starting with missing labels and alt text.");
  if (dashboard.content.total > 0) recs.push("Review spelling and placeholder copy before production.");
  if (dashboard.performance.warnings > 0) recs.push("Profile slow pages and APIs that exceed the warning threshold.");
  if (!recs.length) recs.push("No blocking quality issues were confirmed in the latest analyzed data.");
  return recs;
}

function renderHtmlReport(title: string, payload: Record<string, unknown>) {
  const health = payload.healthScore as { score: number; reasons: string[]; disclaimer: string };
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Inter, ui-sans-serif, system-ui, sans-serif; background:#0b1220; color:#e5e7eb; margin:0; padding:40px; }
    .card { background:#111827; border:1px solid #1f2937; border-radius:16px; padding:24px; margin-bottom:20px; }
    h1,h2 { color:#f8fafc; }
    .accent { color:#2dd4bf; }
    table { width:100%; border-collapse:collapse; }
    td,th { border-bottom:1px solid #1f2937; padding:8px 6px; text-align:left; font-size:14px; }
    .muted { color:#94a3b8; }
  </style>
</head>
<body>
  <div class="card">
    <p class="accent">BugPilot AI · Your AI QA Engineer</p>
    <h1>${escapeHtml(title)}</h1>
    <p>QA Health Score: <strong>${health.score}/100</strong></p>
    <p class="muted">${escapeHtml(health.disclaimer)}</p>
    <ul>${health.reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>
  </div>
  <div class="card">
    <h2>Executive summary</h2>
    <pre style="white-space:pre-wrap">${escapeHtml(JSON.stringify(payload.recommendations, null, 2))}</pre>
  </div>
  <div class="card">
    <h2>Full findings (JSON)</h2>
    <pre style="white-space:pre-wrap; font-size:12px;">${escapeHtml(JSON.stringify(payload, null, 2))}</pre>
  </div>
</body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export const reportService = new ReportService();
