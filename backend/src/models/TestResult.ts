import mongoose, { Schema } from "mongoose";

const testResultSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    testRunId: { type: Schema.Types.ObjectId, ref: "TestRun", required: true, index: true },
    testCaseId: { type: Schema.Types.ObjectId, ref: "TestCase", required: true },
    status: { type: String, enum: ["passed", "failed", "skipped", "blocked"], required: true },
    startedAt: { type: Date, required: true },
    completedAt: { type: Date, required: true },
    durationMs: { type: Number, required: true },
    actualResult: { type: String },
    error: {
      type: { type: String },
      message: { type: String },
      stack: { type: String },
    },
    evidence: {
      screenshotIds: { type: [Schema.Types.ObjectId], default: [] },
      apiRequestIds: { type: [Schema.Types.ObjectId], default: [] },
      consoleLogIds: { type: [Schema.Types.ObjectId], default: [] },
    },
    pageUrl: { type: String },
    classification: {
      type: String,
      enum: [
        "pass",
        "test_failure",
        "expected_failure",
        "environment_issue",
        "network_issue",
        "application_bug",
        "false_positive",
      ],
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

testResultSchema.index({ testRunId: 1, createdAt: -1 });
testResultSchema.index({ projectId: 1, status: 1 });

export const TestResult = mongoose.model("TestResult", testResultSchema);
