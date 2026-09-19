import mongoose, { Schema, type InferSchemaType } from "mongoose";

const statisticsSchema = new Schema(
  {
    pagesDiscovered: { type: Number, default: 0 },
    testsGenerated: { type: Number, default: 0 },
    testsExecuted: { type: Number, default: 0 },
    passed: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    bugs: { type: Number, default: 0 },
    criticalBugs: { type: Number, default: 0 },
    highBugs: { type: Number, default: 0 },
    mediumBugs: { type: Number, default: 0 },
    lowBugs: { type: Number, default: 0 },
    apiRequests: { type: Number, default: 0 },
    apiFailures: { type: Number, default: 0 },
    contentIssues: { type: Number, default: 0 },
    accessibilityIssues: { type: Number, default: 0 },
    performanceWarnings: { type: Number, default: 0 },
  },
  { _id: false },
);

const testRunSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    triggeredBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: [
        "queued",
        "discovering",
        "generating_tests",
        "running",
        "analyzing",
        "completed",
        "failed",
        "cancelled",
      ],
      default: "queued",
      index: true,
    },
    startedAt: { type: Date },
    completedAt: { type: Date },
    configuration: {
      browser: { type: String, required: true },
      maxPages: { type: Number, required: true },
      maxDepth: { type: Number, required: true },
      maxDurationSeconds: { type: Number, required: true },
      headless: { type: Boolean, default: true },
      environment: { type: String, enum: ["prod", "qa", "uat"], default: "qa" },
      baseUrl: { type: String, default: "" },
      captureScreenshots: { type: Boolean, default: false },
    },
    brief: {
      focusMode: {
        type: String,
        enum: ["full", "page", "validation", "flow"],
        default: "full",
      },
      focusPages: { type: [String], default: [] },
      instructions: { type: String, default: "" },
      customCases: { type: [String], default: [] },
    },
    statistics: { type: statisticsSchema, default: () => ({}) },
    currentPage: { type: String },
    currentTestName: { type: String },
    currentStep: { type: String },
    currentActivity: { type: String },
    healthScore: { type: Number },
    healthReasons: { type: [String], default: [] },
    error: {
      code: { type: String },
      message: { type: String },
    },
    cancelRequested: { type: Boolean, default: false },
  },
  { timestamps: true },
);

testRunSchema.index({ projectId: 1, createdAt: -1 });
testRunSchema.index({ projectId: 1, status: 1 });
testRunSchema.index({ status: 1, createdAt: -1 });

export type TestRunDocument = InferSchemaType<typeof testRunSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const TestRun = mongoose.model("TestRun", testRunSchema);
