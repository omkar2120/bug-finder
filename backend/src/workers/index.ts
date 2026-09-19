import { Worker } from "bullmq";
import { connectDatabase } from "../config/db.js";
import { getRedis } from "../config/redis.js";
import { loadEnv } from "../config/env.js";
import { TEST_RUN_QUEUE } from "../jobs/queues.js";
import { processTestRun } from "./testRunProcessor.js";
import { logger } from "../utils/logger.js";

async function main() {
  loadEnv();
  await connectDatabase();
  const worker = new Worker(
    TEST_RUN_QUEUE,
    async (job) => {
      logger.info("Processing test run", { testRunId: job.data.testRunId, jobId: job.id });
      await processTestRun(job.data.testRunId);
    },
    {
      connection: getRedis(),
      concurrency: 1,
    },
  );

  worker.on("failed", (job, error) => {
    logger.error("Worker job failed", { jobId: job?.id, message: error.message });
  });

  logger.info("BugPilot worker listening for test runs");
}

main().catch((error) => {
  logger.error("Worker failed to start", { message: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
