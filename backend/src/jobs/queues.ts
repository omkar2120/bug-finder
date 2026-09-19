import { Queue } from "bullmq";
import { getRedis, pingRedis } from "../config/redis.js";
import { logger } from "../utils/logger.js";

export const TEST_RUN_QUEUE = "test-runs";

let queue: Queue | null = null;

export function getTestRunQueue() {
  if (queue) return queue;
  queue = new Queue(TEST_RUN_QUEUE, { connection: getRedis() });
  return queue;
}

function startInline(testRunId: string) {
  setImmediate(() => {
    import("../workers/testRunProcessor.js")
      .then((mod) => mod.processTestRun(testRunId))
      .catch((runError) => {
        logger.error("In-process test run failed", {
          testRunId,
          message: runError instanceof Error ? runError.message : String(runError),
        });
      });
  });
}

export async function enqueueTestRun(testRunId: string) {
  try {
    await pingRedis();
    await getTestRunQueue().add(
      "execute",
      { testRunId },
      {
        jobId: `${testRunId}-${Date.now()}`,
        removeOnComplete: 100,
        removeOnFail: 100,
        attempts: 1,
      },
    );
  } catch (error) {
    logger.warn("Redis unavailable; the API will run this test inline", {
      testRunId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
  // Always start locally as well. processTestRun claims queued jobs so a
  // separate worker cannot execute the same run twice.
  startInline(testRunId);
}

export async function recoverQueuedRuns() {
  const { TestRun } = await import("../models/TestRun.js");
  const queued = await TestRun.find({ status: "queued" }).select("_id").lean();
  if (!queued.length) return;
  logger.info(`Recovering ${queued.length} queued test run(s)`);
  for (const run of queued) {
    await enqueueTestRun(String(run._id));
  }
}
