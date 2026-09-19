import { Router } from "express";
import { bugController } from "../controllers/bugController.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { updateBugSchema } from "../validators/bug.js";

const router = Router();
router.use(authenticate);
router.get("/:bugId", bugController.get);
router.patch("/:bugId", requireRole("admin", "qa_engineer"), validate({ body: updateBugSchema }), bugController.update);
export default router;
