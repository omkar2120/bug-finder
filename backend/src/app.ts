import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { loadEnv } from "./config/env.js";
import routes from "./routes/index.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

export function createApp() {
  const env = loadEnv();
  const app = express();

  app.set("trust proxy", 1);
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  const allowedOrigins = new Set([
    env.FRONTEND_URL,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
  ]);
  function isAllowedOrigin(origin?: string) {
    if (!origin || allowedOrigins.has(origin)) return true;
    try {
      const host = new URL(origin).hostname.toLowerCase();
      return (
        host.endsWith(".ngrok-free.app") ||
        host.endsWith(".ngrok.app") ||
        host.endsWith(".ngrok.io") ||
        host.endsWith(".ngrok-free.dev")
      );
    } catch {
      return false;
    }
  }
  app.use(
    cors({
      origin(origin, callback) {
        if (isAllowedOrigin(origin)) return callback(null, true);
        return callback(new Error("Origin not allowed by CORS"));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

  const limiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use("/api/v1", limiter);
  app.use(
    "/api/v1/auth/login",
    rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false }),
  );

  app.get("/health", (_req, res) => {
    res.json({ success: true, data: { status: "ok", service: "bugpilot-backend" } });
  });

  app.use("/api/v1", routes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
