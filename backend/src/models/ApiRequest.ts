import mongoose, { Schema } from "mongoose";

const apiRequestSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    testRunId: { type: Schema.Types.ObjectId, ref: "TestRun", required: true, index: true },
    testResultId: { type: Schema.Types.ObjectId, ref: "TestResult" },
    timestamp: { type: Date, required: true, default: () => new Date() },
    method: {
      type: String,
      enum: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
      required: true,
    },
    url: { type: String, required: true },
    endpoint: { type: String, required: true },
    request: {
      headers: { type: Schema.Types.Mixed, default: {} },
      body: { type: Schema.Types.Mixed },
    },
    response: {
      status: { type: Number },
      statusText: { type: String },
      headers: { type: Schema.Types.Mixed, default: {} },
      body: { type: Schema.Types.Mixed },
      sizeBytes: { type: Number },
    },
    timing: {
      durationMs: { type: Number, default: 0 },
      dnsMs: { type: Number },
      connectMs: { type: Number },
      ttfbMs: { type: Number },
      downloadMs: { type: Number },
    },
    result: {
      type: String,
      enum: ["success", "client_error", "server_error", "network_error", "timeout"],
      required: true,
    },
    pageUrl: { type: String },
    aiAnalysis: {
      suspicious: { type: Boolean, default: false },
      confidence: { type: Number },
      issue: { type: String },
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

apiRequestSchema.index({ testRunId: 1, createdAt: -1 });
apiRequestSchema.index({ projectId: 1, createdAt: -1 });
apiRequestSchema.index({ testRunId: 1, result: 1 });
apiRequestSchema.index({ testRunId: 1, method: 1 });

export const ApiRequest = mongoose.model("ApiRequest", apiRequestSchema);
