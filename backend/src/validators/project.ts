import { z } from "zod";

const urlSchema = z
  .string()
  .url()
  .refine((value) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }, "Invalid project URL");

const optionalUrl = z
  .string()
  .trim()
  .optional()
  .refine((value) => !value || urlSchema.safeParse(value).success, "Invalid project URL");

const environmentSchema = z.enum(["prod", "qa", "uat", "development", "staging", "production", "custom"]);

const projectFields = {
  name: z.string().min(2).max(120),
  description: z.string().max(2000).optional().default(""),
  applicationUrl: optionalUrl,
  environment: environmentSchema.default("qa"),
  prodUrl: optionalUrl,
  qaUrl: optionalUrl,
  uatUrl: optionalUrl,
  allowedDomains: z.array(z.string().min(1)).optional(),
  maxPages: z.number().int().min(1).max(200).default(25),
  maxDepth: z.number().int().min(1).max(10).default(3),
  maxDurationSeconds: z.number().int().min(30).max(3600).default(300),
  browser: z.enum(["chromium", "firefox", "webkit"]).default("chromium"),
  testConcurrency: z.number().int().min(1).max(5).default(1),
  headless: z.boolean().optional().default(true),
  captureScreenshots: z.boolean().optional(),
  requirements: z
    .array(
      z.object({
        text: z.string().min(1),
        priority: z.enum(["critical", "high", "medium", "low"]).default("medium"),
      }),
    )
    .optional()
    .default([]),
  loginUsername: z.string().optional(),
  loginPassword: z.string().optional(),
};

function hasAnyUrl(value: {
  applicationUrl?: string;
  prodUrl?: string;
  qaUrl?: string;
  uatUrl?: string;
}) {
  return Boolean(value.applicationUrl || value.prodUrl || value.qaUrl || value.uatUrl);
}

export const createProjectSchema = z
  .object({
    ...projectFields,
    acknowledgedAuthorization: z.literal(true, {
      errorMap: () => ({
        message: "You must confirm you are authorized to test this application",
      }),
    }),
  })
  .refine(hasAnyUrl, {
    message: "Add at least one environment URL (PROD, QA, or UAT)",
    path: ["qaUrl"],
  });

export const updateProjectSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(2000).optional(),
  applicationUrl: optionalUrl,
  environment: environmentSchema.optional(),
  prodUrl: optionalUrl,
  qaUrl: optionalUrl,
  uatUrl: optionalUrl,
  allowedDomains: z.array(z.string().min(1)).optional(),
  maxPages: z.number().int().min(1).max(200).optional(),
  maxDepth: z.number().int().min(1).max(10).optional(),
  maxDurationSeconds: z.number().int().min(30).max(3600).optional(),
  browser: z.enum(["chromium", "firefox", "webkit"]).optional(),
  testConcurrency: z.number().int().min(1).max(5).optional(),
  headless: z.boolean().optional(),
  captureScreenshots: z.boolean().optional(),
  requirements: z
    .array(
      z.object({
        text: z.string().min(1),
        priority: z.enum(["critical", "high", "medium", "low"]).default("medium"),
      }),
    )
    .optional(),
  status: z.enum(["active", "archived"]).optional(),
  loginUsername: z.string().optional(),
  loginPassword: z.string().optional(),
});

export const objectIdParam = (name: string) =>
  z.object({
    [name]: z.string().regex(/^[a-fA-F0-9]{24}$/, `Invalid ${name}`),
  });
