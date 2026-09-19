import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { qualityController } from "../controllers/qualityController.js";
import authRoutes from "./auth.js";
import projectRoutes from "./projects.js";
import testRunRoutes from "./testRuns.js";
import bugRoutes from "./bugs.js";

const router = Router();

router.use("/auth", authRoutes);
router.get("/dashboard", authenticate, qualityController.globalDashboard);
router.get("/api-requests/:requestId", authenticate, qualityController.apiRequest);
router.get("/screenshots/:screenshotId", authenticate, qualityController.screenshot);
router.get("/reports/:reportId/download", authenticate, qualityController.downloadReport);
router.use("/projects", projectRoutes);
router.use("/test-runs", testRunRoutes);
router.use("/bugs", bugRoutes);

export default router;
