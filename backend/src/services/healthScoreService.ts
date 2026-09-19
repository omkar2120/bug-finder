import { loadEnv } from "../config/env.js";

export interface HealthInputs {
  criticalBugs: number;
  highBugs: number;
  apiFailures: number;
  accessibilityIssues: number;
  contentIssues: number;
  performanceWarnings: number;
  testsExecuted: number;
  passed: number;
}

export function calculateHealthScore(input: HealthInputs) {
  const env = loadEnv();
  const reasons: string[] = [];
  let score = 100;

  const critPenalty = Math.min(40, input.criticalBugs * env.HEALTH_SCORE_CRITICAL_BUG_PENALTY);
  if (input.criticalBugs > 0) {
    score -= critPenalty;
    reasons.push(`-${critPenalty} critical bugs (${input.criticalBugs})`);
  }

  const highPenalty = Math.min(25, input.highBugs * env.HEALTH_SCORE_HIGH_BUG_PENALTY);
  if (input.highBugs > 0) {
    score -= highPenalty;
    reasons.push(`-${highPenalty} high bugs (${input.highBugs})`);
  }

  const apiPenalty = Math.min(20, input.apiFailures * env.HEALTH_SCORE_API_FAILURE_PENALTY);
  if (input.apiFailures > 0) {
    score -= apiPenalty;
    reasons.push(`-${apiPenalty} API failures (${input.apiFailures})`);
  }

  const a11yPenalty = Math.min(15, input.accessibilityIssues * env.HEALTH_SCORE_A11Y_PENALTY);
  if (input.accessibilityIssues > 0) {
    score -= a11yPenalty;
    reasons.push(`-${a11yPenalty} accessibility findings (${input.accessibilityIssues})`);
  }

  const contentPenalty = Math.min(10, input.contentIssues * env.HEALTH_SCORE_CONTENT_PENALTY);
  if (input.contentIssues > 0) {
    score -= contentPenalty;
    reasons.push(`-${contentPenalty} content issues (${input.contentIssues})`);
  }

  const perfPenalty = Math.min(10, input.performanceWarnings * env.HEALTH_SCORE_PERF_PENALTY);
  if (input.performanceWarnings > 0) {
    score -= perfPenalty;
    reasons.push(`-${perfPenalty} performance warnings (${input.performanceWarnings})`);
  }

  const passRate = input.testsExecuted > 0 ? input.passed / input.testsExecuted : 0;
  if (passRate >= 0.85 && input.testsExecuted >= 3) {
    score += env.HEALTH_SCORE_PASS_RATE_BONUS;
    reasons.push(`+${env.HEALTH_SCORE_PASS_RATE_BONUS} high test pass rate`);
  } else if (input.testsExecuted > 0 && passRate < 0.6) {
    score -= 6;
    reasons.push("-6 low test pass rate");
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasons,
    disclaimer: "BugPilot QA Health Score is a product-defined heuristic, not an industry standard.",
  };
}
