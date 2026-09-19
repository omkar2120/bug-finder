import mongoose, { Schema } from "mongoose";

const consoleLogSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    testRunId: { type: Schema.Types.ObjectId, ref: "TestRun", required: true, index: true },
    testResultId: { type: Schema.Types.ObjectId, ref: "TestResult" },
    pageUrl: { type: String },
    level: { type: String, enum: ["log", "info", "warning", "error", "debug"], required: true },
    message: { type: String, required: true },
    timestamp: { type: Date, default: () => new Date() },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

consoleLogSchema.index({ testRunId: 1, createdAt: -1 });
consoleLogSchema.index({ testRunId: 1, level: 1 });

export const ConsoleLog = mongoose.model("ConsoleLog", consoleLogSchema);
