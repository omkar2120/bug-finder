import mongoose, { Schema } from "mongoose";

const bugSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    testRunId: { type: Schema.Types.ObjectId, ref: "TestRun", required: true, index: true },
    bugKey: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: {
      type: String,
      enum: [
        "functional",
        "validation",
        "api",
        "authentication",
        "authorization",
        "content",
        "accessibility",
        "performance",
        "ui",
        "security",
        "other",
      ],
      required: true,
    },
    severity: { type: String, enum: ["critical", "high", "medium", "low"], required: true, index: true },
    priority: { type: String, enum: ["P0", "P1", "P2", "P3"], required: true },
    status: {
      type: String,
      enum: ["new", "confirmed", "duplicate", "false_positive", "resolved", "reopened"],
      default: "new",
      index: true,
    },
    confidence: { type: Number, required: true },
    page: {
      url: { type: String, required: true },
      title: { type: String },
    },
    reproduction: {
      steps: { type: [String], default: [] },
      expected: { type: String, required: true },
      actual: { type: String, required: true },
    },
    rootCause: { type: String },
    relatedTests: { type: [Schema.Types.ObjectId], default: [] },
    relatedApiRequests: { type: [Schema.Types.ObjectId], default: [] },
    duplicateOf: { type: Schema.Types.ObjectId, ref: "Bug" },
    evidence: {
      screenshotIds: { type: [Schema.Types.ObjectId], default: [] },
      consoleLogIds: { type: [Schema.Types.ObjectId], default: [] },
      apiRequestIds: { type: [Schema.Types.ObjectId], default: [] },
    },
    aiAnalysis: {
      model: { type: String },
      summary: { type: String },
      confidence: { type: Number },
      generatedAt: { type: Date },
    },
    externalIssues: {
      type: [
        {
          provider: { type: String, enum: ["jira", "github"] },
          issueId: { type: String },
          issueUrl: { type: String },
        },
      ],
      default: [],
    },
  },
  { timestamps: true },
);

bugSchema.index({ projectId: 1, bugKey: 1 }, { unique: true });
bugSchema.index({ projectId: 1, createdAt: -1 });
bugSchema.index({ projectId: 1, status: 1 });
bugSchema.index({ projectId: 1, severity: 1 });
bugSchema.index({ testRunId: 1, createdAt: -1 });

export const Bug = mongoose.model("Bug", bugSchema);
