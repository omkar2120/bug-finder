import { TimelineEvent } from "../models/TimelineEvent.js";
import { eventBus, type TestRunEvent } from "../events/eventBus.js";
import type { SseEventType } from "@bugpilot/shared";

export async function emitRunEvent(input: {
  type: SseEventType;
  testRunId: string;
  projectId: string;
  message: string;
  level?: TestRunEvent["level"];
  payload?: Record<string, unknown>;
}) {
  const createdAt = new Date();
  await TimelineEvent.create({
    projectId: input.projectId,
    testRunId: input.testRunId,
    type: input.type,
    message: input.message,
    level: input.level ?? "info",
    payload: input.payload,
  });
  eventBus.publish({
    ...input,
    createdAt: createdAt.toISOString(),
  });
}

export async function listTimeline(testRunId: string) {
  return TimelineEvent.find({ testRunId }).sort({ createdAt: 1 }).lean();
}
