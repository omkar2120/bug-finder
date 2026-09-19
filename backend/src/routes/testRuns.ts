import { Router } from "express";
import { testRunController } from "../controllers/testRunController.js";
import { qualityController } from "../controllers/qualityController.js";
import { authenticate, requireRole } from "../middleware/auth.js";

const router = Router();
router.use(authenticate);

router.get("/:testRunId", testRunController.get);
router.post("/:testRunId/cancel", requireRole("admin", "qa_engineer"), testRunController.cancel);
router.post("/:testRunId/retry", requireRole("admin", "qa_engineer"), testRunController.retry);
router.get("/:testRunId/events", testRunController.events);
router.get("/:testRunId/test-cases", testRunController.cases);
router.get("/:testRunId/test-results", testRunController.results);
router.get("/:testRunId/bugs", testRunController.bugs);
router.get("/:testRunId/screenshots", qualityController.screenshots);
router.get("/:testRunId/api-requests", qualityController.apiRequests);
router.get("/:testRunId/content-issues", qualityController.contentIssues);
router.get("/:testRunId/accessibility-issues", qualityController.accessibilityIssues);
router.get("/:testRunId/performance", qualityController.performance);
router.get("/:testRunId/console-logs", qualityController.consoleLogs);

export default router;
