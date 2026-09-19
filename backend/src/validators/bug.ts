import { z } from "zod";

export const updateBugSchema = z.object({
  status: z.enum(["new", "confirmed", "duplicate", "false_positive", "resolved", "reopened"]).optional(),
  severity: z.enum(["critical", "high", "medium", "low"]).optional(),
  priority: z.enum(["P0", "P1", "P2", "P3"]).optional(),
  duplicateOf: z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
});

export const createReportSchema = z.object({
  type: z.enum(["full_qa", "test", "bug", "api", "content", "accessibility", "performance"]).default("full_qa"),
  format: z.enum(["html", "json"]).default("html"),
  testRunId: z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
});
