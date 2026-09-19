import { Router } from "express";
import { authController } from "../controllers/authController.js";
import { validate } from "../middleware/validate.js";
import { authenticate } from "../middleware/auth.js";
import {
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
} from "../validators/auth.js";

const router = Router();

router.post("/register", validate({ body: registerSchema }), authController.register);
router.post("/login", validate({ body: loginSchema }), authController.login);
router.post("/refresh", validate({ body: refreshSchema }), authController.refresh);
router.post("/logout", authController.logout);
router.get("/me", authenticate, authController.me);
router.post("/forgot-password", validate({ body: forgotPasswordSchema }), authController.forgotPassword);
router.post("/reset-password", validate({ body: resetPasswordSchema }), authController.resetPassword);

export default router;
