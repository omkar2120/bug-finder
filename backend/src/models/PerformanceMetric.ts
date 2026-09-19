import mongoose, { Schema } from "mongoose";

const performanceMetricSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    testRunId: { type: Schema.Types.ObjectId, ref: "TestRun", required: true, index: true },
    pageUrl: { type: String, required: true },
    ttfbMs: { type: Number },
    domContentLoadedMs: { type: Number },
    loadMs: { type: Number },
    transferSizeBytes: { type: Number },
    failedRequests: { type: Number, default: 0 },
    warning: { type: Boolean, default: false },
    warningReason: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

performanceMetricSchema.index({ testRunId: 1, createdAt: -1 });
performanceMetricSchema.index({ projectId: 1, createdAt: -1 });

export const PerformanceMetric = mongoose.model("PerformanceMetric", performanceMetricSchema);
