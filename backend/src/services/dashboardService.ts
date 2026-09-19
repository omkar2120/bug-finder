import { Project } from "../models/Project.js";
import { TestRun } from "../models/TestRun.js";
import { TestResult } from "../models/TestResult.js";
import { Bug } from "../models/Bug.js";
import { ApiRequest } from "../models/ApiRequest.js";
import { ContentIssue } from "../models/ContentIssue.js";
import { AccessibilityIssue } from "../models/AccessibilityIssue.js";
import { PerformanceMetric } from "../models/PerformanceMetric.js";
import { AiAnalysis } from "../models/AiAnalysis.js";
import { calculateHealthScore } from "./healthScoreService.js";

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function lastNDays(n: number) {
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    days.push(dayKey(d));
  }
  return days;
}

function trendFromCounts(days: string[], docs: Array<{ createdAt: Date }>, extra?: (doc: unknown, bucket: Record<string, number>) => void) {
  const map = Object.fromEntries(days.map((d) => [d, 0]));
  for (const doc of docs) {
    const key = dayKey(doc.createdAt);
    if (key in map) {
      map[key] += 1;
      extra?.(doc, map);
    }
  }
  return days.map((date) => ({ date, value: map[date] }));
}

export class DashboardService {
  async global(userId: string, role: string) {
    const projectFilter =
      role === "admin" ? {} : { $or: [{ ownerId: userId }, { "members.userId": userId }] };
    const projects = await Project.find(projectFilter).select("_id status name updatedAt").lean();
    const projectIds = projects.map((p) => p._id);

    const [testRuns, testResults, bugs, apiFailures, contentIssues, a11yIssues, perfWarnings, recentRuns, recentBugs, recentProjects, recentAnalyses] =
      await Promise.all([
        TestRun.find({ projectId: { $in: projectIds } }).sort({ createdAt: -1 }).lean(),
        TestResult.find({ projectId: { $in: projectIds } }).lean(),
        Bug.find({ projectId: { $in: projectIds } }).lean(),
        ApiRequest.countDocuments({ projectId: { $in: projectIds }, result: { $in: ["client_error", "server_error", "network_error", "timeout"] } }),
        ContentIssue.countDocuments({ projectId: { $in: projectIds } }),
        AccessibilityIssue.countDocuments({ projectId: { $in: projectIds } }),
        PerformanceMetric.countDocuments({ projectId: { $in: projectIds }, warning: true }),
        TestRun.find({ projectId: { $in: projectIds } }).sort({ createdAt: -1 }).limit(6).lean(),
        Bug.find({ projectId: { $in: projectIds } }).sort({ createdAt: -1 }).limit(6).lean(),
        Project.find(projectFilter).sort({ updatedAt: -1 }).limit(6).lean(),
        AiAnalysis.find({ projectId: { $in: projectIds } }).sort({ createdAt: -1 }).limit(6).lean(),
      ]);

    const passed = testResults.filter((r) => r.status === "passed").length;
    const failed = testResults.filter((r) => r.status === "failed").length;
    const days = lastNDays(14);

    const passFailTrend = days.map((date) => {
      const dayResults = testResults.filter((r) => dayKey(r.createdAt as Date) === date);
      return {
        date,
        passed: dayResults.filter((r) => r.status === "passed").length,
        failed: dayResults.filter((r) => r.status === "failed").length,
      };
    });

    const apiRequests = await ApiRequest.find({
      projectId: { $in: projectIds },
      createdAt: { $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
    }).select("timing createdAt").lean();

    const apiTrend = days.map((date) => {
      const day = apiRequests.filter((r) => dayKey(r.createdAt as Date) === date);
      const avg = day.length
        ? Math.round(day.reduce((sum, r) => sum + (r.timing?.durationMs ?? 0), 0) / day.length)
        : 0;
      return { date, avgMs: avg, count: day.length };
    });

    return {
      totals: {
        totalProjects: projects.length,
        activeProjects: projects.filter((p) => p.status === "active").length,
        totalTestRuns: testRuns.length,
        totalTests: testResults.length,
        passRate: testResults.length ? Math.round((passed / testResults.length) * 100) : 0,
        failedTests: failed,
        totalBugs: bugs.length,
        criticalBugs: bugs.filter((b) => b.severity === "critical").length,
        highBugs: bugs.filter((b) => b.severity === "high").length,
        apiFailures,
        contentIssues,
        accessibilityIssues: a11yIssues,
        performanceWarnings: perfWarnings,
      },
      charts: {
        testExecutionTrend: trendFromCounts(days, testRuns as Array<{ createdAt: Date }>),
        passFailTrend,
        bugTrend: trendFromCounts(days, bugs as Array<{ createdAt: Date }>),
        apiResponseTimeTrend: apiTrend,
        bugSeverityDistribution: ["critical", "high", "medium", "low"].map((severity) => ({
          severity,
          count: bugs.filter((b) => b.severity === severity).length,
        })),
      },
      recentProjects,
      recentRuns,
      recentBugs,
      criticalBugs: bugs.filter((b) => b.severity === "critical").slice(0, 6),
      latestAiFindings: recentAnalyses,
    };
  }

  async projectDashboard(projectId: string) {
    const [
      runs,
      results,
      bugs,
      apis,
      contentIssues,
      a11yIssues,
      perfMetrics,
      recentRuns,
      recentBugs,
    ] = await Promise.all([
      TestRun.find({ projectId }).sort({ createdAt: -1 }).lean(),
      TestResult.find({ projectId }).lean(),
      Bug.find({ projectId }).lean(),
      ApiRequest.find({ projectId }).lean(),
      ContentIssue.find({ projectId }).lean(),
      AccessibilityIssue.find({ projectId }).lean(),
      PerformanceMetric.find({ projectId }).lean(),
      TestRun.find({ projectId }).sort({ createdAt: -1 }).limit(8).lean(),
      Bug.find({ projectId }).sort({ createdAt: -1 }).limit(8).lean(),
    ]);

    const passed = results.filter((r) => r.status === "passed").length;
    const failed = results.filter((r) => r.status === "failed").length;
    const apiFailures = apis.filter((a) => a.result !== "success").length;
    const perfWarnings = perfMetrics.filter((p) => p.warning).length;
    const health = calculateHealthScore({
      criticalBugs: bugs.filter((b) => b.severity === "critical" && !["false_positive", "duplicate"].includes(b.status)).length,
      highBugs: bugs.filter((b) => b.severity === "high" && !["false_positive", "duplicate"].includes(b.status)).length,
      apiFailures,
      accessibilityIssues: a11yIssues.length,
      contentIssues: contentIssues.length,
      performanceWarnings: perfWarnings,
      testsExecuted: results.length,
      passed,
    });

    const days = lastNDays(14);
    return {
      tests: {
        runs: runs.length,
        executed: results.length,
        passed,
        failed,
        passRate: results.length ? Math.round((passed / results.length) * 100) : 0,
      },
      bugs: {
        total: bugs.length,
        critical: bugs.filter((b) => b.severity === "critical").length,
        high: bugs.filter((b) => b.severity === "high").length,
        medium: bugs.filter((b) => b.severity === "medium").length,
        low: bugs.filter((b) => b.severity === "low").length,
        open: bugs.filter((b) => !["resolved", "false_positive", "duplicate"].includes(b.status)).length,
      },
      apis: {
        total: apis.length,
        success: apis.filter((a) => a.result === "success").length,
        clientErrors: apis.filter((a) => a.result === "client_error").length,
        serverErrors: apis.filter((a) => a.result === "server_error").length,
        networkFailures: apis.filter((a) => a.result === "network_error").length,
        timeouts: apis.filter((a) => a.result === "timeout").length,
        avgResponseMs: apis.length
          ? Math.round(apis.reduce((sum, a) => sum + (a.timing?.durationMs ?? 0), 0) / apis.length)
          : 0,
      },
      content: { total: contentIssues.length },
      accessibility: { total: a11yIssues.length },
      performance: {
        warnings: perfWarnings,
        avgLoadMs: perfMetrics.length
          ? Math.round(perfMetrics.reduce((sum, p) => sum + (p.loadMs ?? 0), 0) / perfMetrics.length)
          : 0,
        avgApiMs: apis.length
          ? Math.round(apis.reduce((sum, a) => sum + (a.timing?.durationMs ?? 0), 0) / apis.length)
          : 0,
      },
      recentRuns,
      recentBugs,
      trends: {
        passFailTrend: days.map((date) => {
          const dayResults = results.filter((r) => dayKey(r.createdAt as Date) === date);
          return {
            date,
            passed: dayResults.filter((r) => r.status === "passed").length,
            failed: dayResults.filter((r) => r.status === "failed").length,
          };
        }),
        bugTrend: days.map((date) => ({
          date,
          value: bugs.filter((b) => dayKey(b.createdAt as Date) === date).length,
        })),
      },
      healthScore: health,
    };
  }
}

export const dashboardService = new DashboardService();
