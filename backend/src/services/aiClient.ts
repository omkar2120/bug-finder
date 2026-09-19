import { loadEnv } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { AiAnalysis } from "../models/AiAnalysis.js";

async function callInternal<T>(path: string, body: unknown): Promise<T> {
  const env = loadEnv();
  const response = await fetch(`${env.AI_SERVICE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-BugPilot-Service-Key": env.AI_SERVICE_SECRET,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI service error (${response.status}): ${text.slice(0, 300)}`);
  }
  return (await response.json()) as T;
}

export async function generateTests(input: {
  projectId: string;
  testRunId: string;
  applicationContext: unknown;
  requirements: unknown[];
  brief?: {
    focusMode?: string;
    focusPages?: string[];
    instructions?: string;
    customCases?: string[];
  };
  limits: { maxTests: number };
}) {
  const started = Date.now();
  const result = await callInternal<{
    tests: unknown[];
    provider?: string;
    model?: string;
    tokenUsage?: { input: number; output: number; total: number };
  }>("/internal/ai/test-generation", input);
  await AiAnalysis.create({
    projectId: input.projectId,
    testRunId: input.testRunId,
    type: "test_generation",
    provider: result.provider ?? loadEnv().AI_PROVIDER,
    model: result.model ?? loadEnv().AI_MODEL,
    output: { testCount: result.tests.length },
    tokenUsage: result.tokenUsage,
    durationMs: Date.now() - started,
  });
  return result;
}

export async function analyzeBug(input: Record<string, unknown> & { projectId: string; testRunId: string }) {
  const started = Date.now();
  try {
    const result = await callInternal<Record<string, unknown>>("/internal/ai/analyze-bug", input);
    await AiAnalysis.create({
      projectId: input.projectId,
      testRunId: input.testRunId,
      type: "bug_analysis",
      provider: (result.provider as string) ?? loadEnv().AI_PROVIDER,
      model: (result.model as string) ?? loadEnv().AI_MODEL,
      output: result,
      confidence: result.confidence as number | undefined,
      durationMs: Date.now() - started,
    });
    return result;
  } catch (error) {
    logger.error("AI bug analysis failed", { message: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

export async function analyzeContent(input: Record<string, unknown> & { projectId: string; testRunId: string }) {
  const started = Date.now();
  const result = await callInternal<{ issues: unknown[]; provider?: string; model?: string }>(
    "/internal/ai/analyze-content",
    input,
  );
  await AiAnalysis.create({
    projectId: input.projectId,
    testRunId: input.testRunId,
    type: "content_analysis",
    provider: result.provider ?? loadEnv().AI_PROVIDER,
    model: result.model ?? loadEnv().AI_MODEL,
    output: { issueCount: result.issues.length },
    durationMs: Date.now() - started,
  });
  return result;
}

export async function detectDuplicates(input: {
  projectId: string;
  testRunId: string;
  bugs: unknown[];
}) {
  const started = Date.now();
  const result = await callInternal<{ groups: unknown[]; provider?: string; model?: string }>(
    "/internal/ai/detect-duplicates",
    input,
  );
  await AiAnalysis.create({
    projectId: input.projectId,
    testRunId: input.testRunId,
    type: "duplicate_detection",
    provider: result.provider ?? loadEnv().AI_PROVIDER,
    model: result.model ?? loadEnv().AI_MODEL,
    output: result,
    durationMs: Date.now() - started,
  });
  return result;
}

export async function analyzeRisk(input: {
  projectId: string;
  testRunId: string;
  statistics: unknown;
}) {
  const started = Date.now();
  const result = await callInternal<Record<string, unknown>>("/internal/ai/analyze-risk", input);
  await AiAnalysis.create({
    projectId: input.projectId,
    testRunId: input.testRunId,
    type: "risk_analysis",
    provider: (result.provider as string) ?? loadEnv().AI_PROVIDER,
    model: (result.model as string) ?? loadEnv().AI_MODEL,
    output: result,
    durationMs: Date.now() - started,
  });
  return result;
}

export async function analyzeVisual(input: Record<string, unknown> & { projectId: string; testRunId: string }) {
  const started = Date.now();
  const result = await callInternal<Record<string, unknown>>("/internal/ai/analyze-visual", input);
  await AiAnalysis.create({
    projectId: input.projectId,
    testRunId: input.testRunId,
    type: "visual_analysis",
    provider: (result.provider as string) ?? loadEnv().AI_PROVIDER,
    model: (result.model as string) ?? loadEnv().AI_MODEL,
    output: result,
    durationMs: Date.now() - started,
  });
  return result;
}
