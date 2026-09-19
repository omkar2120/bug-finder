import dotenv from "dotenv";
import { z } from "zod";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
dotenv.config({ path: path.join(rootDir, ".env") });
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  ENCRYPTION_KEY: z.string().min(32),
  FRONTEND_URL: z.string().url().default("http://localhost:5173"),
  AI_SERVICE_URL: z.string().url().default("http://127.0.0.1:8000"),
  AI_SERVICE_SECRET: z.string().min(8),
  AI_PROVIDER: z.string().default("local"),
  AI_MODEL: z.string().default("local-heuristic"),
  AI_API_KEY: z.string().optional().default(""),
  STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
  STORAGE_PATH: z.string().default("./storage"),
  S3_BUCKET: z.string().optional().default(""),
  S3_REGION: z.string().optional().default(""),
  S3_ENDPOINT: z.string().optional().default(""),
  S3_ACCESS_KEY: z.string().optional().default(""),
  S3_SECRET_KEY: z.string().optional().default(""),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().default(120),
  HEALTH_SCORE_CRITICAL_BUG_PENALTY: z.coerce.number().default(10),
  HEALTH_SCORE_HIGH_BUG_PENALTY: z.coerce.number().default(5),
  HEALTH_SCORE_API_FAILURE_PENALTY: z.coerce.number().default(4),
  HEALTH_SCORE_A11Y_PENALTY: z.coerce.number().default(3),
  HEALTH_SCORE_CONTENT_PENALTY: z.coerce.number().default(2),
  HEALTH_SCORE_PERF_PENALTY: z.coerce.number().default(2),
  HEALTH_SCORE_PASS_RATE_BONUS: z.coerce.number().default(7),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function loadEnv(overrides?: Partial<NodeJS.ProcessEnv>): Env {
  if (cached && !overrides) return cached;
  const parsed = envSchema.safeParse({ ...process.env, ...overrides });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  if (!overrides) cached = parsed.data;
  return parsed.data;
}

export function resetEnvCache() {
  cached = null;
}
