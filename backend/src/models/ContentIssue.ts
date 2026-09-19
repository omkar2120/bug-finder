import mongoose, { Schema } from "mongoose";

const contentIssueSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    testRunId: { type: Schema.Types.ObjectId, ref: "TestRun", required: true, index: true },
    pageUrl: { type: String, required: true },
    type: {
      type: String,
      enum: [
        "spelling",
        "grammar",
        "broken_text",
        "placeholder",
        "inconsistent_label",
        "translation",
        "undefined_text",
        "other",
      ],
      required: true,
    },
    currentText: { type: String, required: true },
    suggestedText: { type: String },
    element: {
      selector: { type: String },
      tag: { type: String },
    },
    severity: { type: String, enum: ["high", "medium", "low"], required: true },
    confidence: { type: Number, required: true },
    screenshotId: { type: Schema.Types.ObjectId, ref: "Screenshot" },
    aiAnalysis: {
      model: { type: String },
      explanation: { type: String },
    },
    status: { type: String, enum: ["open", "accepted", "ignored", "fixed"], default: "open" },
  },
  { timestamps: true },
);

contentIssueSchema.index({ testRunId: 1, createdAt: -1 });
contentIssueSchema.index({ projectId: 1, status: 1 });

export const ContentIssue = mongoose.model("ContentIssue", contentIssueSchema);
