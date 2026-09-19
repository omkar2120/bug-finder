import mongoose, { Schema } from "mongoose";

const aiAnalysisSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    testRunId: { type: Schema.Types.ObjectId, ref: "TestRun", required: true, index: true },
    type: {
      type: String,
      enum: [
        "test_generation",
        "bug_analysis",
        "root_cause",
        "content_analysis",
        "visual_analysis",
        "duplicate_detection",
        "risk_analysis",
        "api_analysis",
      ],
      required: true,
    },
    provider: { type: String, required: true },
    model: { type: String, required: true },
    inputReference: {
      type: { type: String },
      id: { type: Schema.Types.ObjectId },
    },
    output: { type: Schema.Types.Mixed },
    confidence: { type: Number },
    tokenUsage: {
      input: { type: Number },
      output: { type: Number },
      total: { type: Number },
    },
    durationMs: { type: Number },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

aiAnalysisSchema.index({ testRunId: 1, createdAt: -1 });
aiAnalysisSchema.index({ projectId: 1, type: 1, createdAt: -1 });

export const AiAnalysis = mongoose.model("AiAnalysis", aiAnalysisSchema);
