import { createApp } from "./app.js";
import { connectDatabase } from "./config/db.js";
import { loadEnv } from "./config/env.js";
import { logger } from "./utils/logger.js";

async function main() {
  const env = loadEnv();
  await connectDatabase();
  const app = createApp();
  app.listen(env.PORT, "0.0.0.0", () => {
    logger.info(`BugPilot API listening on 0.0.0.0:${env.PORT}`);
    import("./jobs/queues.js")
      .then((mod) => mod.recoverQueuedRuns())
      .catch((error) => {
        logger.error("Failed to recover queued test runs", {
          message: error instanceof Error ? error.message : String(error),
        });
      });
  });
}

main().catch((error) => {
  logger.error("Failed to start API", { message: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
