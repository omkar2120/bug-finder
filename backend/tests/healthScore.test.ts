import { beforeEach, describe, expect, it } from "vitest";
import { calculateHealthScore } from "../src/services/healthScoreService.js";
import { resetEnvCache } from "../src/config/env.js";

describe("QA health score", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/bugpilot-test";
    process.env.REDIS_URL = "redis://127.0.0.1:6379";
    process.env.JWT_ACCESS_SECRET = "test-access-secret-value-32";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret-value-32";
    process.env.ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    process.env.AI_SERVICE_SECRET = "test-ai-secret";
    process.env.FRONTEND_URL = "http://localhost:5173";
    resetEnvCache();
  });

  it("starts near 100 when there are no issues", () => {
    const result = calculateHealthScore({
      criticalBugs: 0,
      highBugs: 0,
      apiFailures: 0,
      accessibilityIssues: 0,
      contentIssues: 0,
      performanceWarnings: 0,
      testsExecuted: 10,
      passed: 10,
    });
    expect(result.score).toBeGreaterThanOrEqual(100);
    expect(result.disclaimer).toContain("not an industry standard");
  });

  it("penalizes critical bugs more than content issues", () => {
    const critical = calculateHealthScore({
      criticalBugs: 2,
      highBugs: 0,
      apiFailures: 0,
      accessibilityIssues: 0,
      contentIssues: 0,
      performanceWarnings: 0,
      testsExecuted: 10,
      passed: 8,
    });
    const content = calculateHealthScore({
      criticalBugs: 0,
      highBugs: 0,
      apiFailures: 0,
      accessibilityIssues: 0,
      contentIssues: 2,
      performanceWarnings: 0,
      testsExecuted: 10,
      passed: 8,
    });
    expect(critical.score).toBeLessThan(content.score);
  });
});
