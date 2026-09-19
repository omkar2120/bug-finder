import { Router } from "express";
import { projectController } from "../controllers/projectController.js";
import { testRunController } from "../controllers/testRunController.js";
import { bugController } from "../controllers/bugController.js";
import { qualityController } from "../controllers/qualityController.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { authorizeProject } from "../middleware/authorizeProject.js";
import { validate } from "../middleware/validate.js";
import { createProjectSchema, objectIdParam, updateProjectSchema } from "../validators/project.js";
import { createReportSchema } from "../validators/bug.js";

const router = Router();

router.use(authenticate);

router.get("/", projectController.list);
router.post("/", requireRole("admin", "qa_engineer"), validate({ body: createProjectSchema }), projectController.create);
router.get("/:projectId", validate({ params: objectIdParam("projectId") }), authorizeProject("read"), projectController.get);
router.patch("/:projectId", validate({ params: objectIdParam("projectId"), body: updateProjectSchema }), authorizeProject("manage"), projectController.update);
router.delete("/:projectId", validate({ params: objectIdParam("projectId") }), authorizeProject("manage"), projectController.archive);
router.get("/:projectId/dashboard", authorizeProject("read"), projectController.dashboard);

router.post("/:projectId/test-runs", authorizeProject("write"), testRunController.create);
router.get("/:projectId/test-runs", authorizeProject("read"), testRunController.list);
router.get("/:projectId/bugs", authorizeProject("read"), bugController.list);
router.get("/:projectId/apis", authorizeProject("read"), qualityController.projectApis);
router.get("/:projectId/content-issues", authorizeProject("read"), qualityController.projectContent);
router.get("/:projectId/accessibility-issues", authorizeProject("read"), qualityController.projectAccessibility);
router.get("/:projectId/performance", authorizeProject("read"), qualityController.projectPerformance);
router.get("/:projectId/reports", authorizeProject("read"), qualityController.reports);
router.post("/:projectId/reports", authorizeProject("write"), validate({ body: createReportSchema }), qualityController.createReport);

export default router;
