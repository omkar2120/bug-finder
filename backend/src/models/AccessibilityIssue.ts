import mongoose, { Schema } from "mongoose";

const accessibilityIssueSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    testRunId: { type: Schema.Types.ObjectId, ref: "TestRun", required: true, index: true },
    pageUrl: { type: String, required: true },
    ruleId: { type: String, required: true },
    impact: { type: String, enum: ["critical", "serious", "moderate", "minor"], required: true },
    description: { type: String, required: true },
    help: { type: String },
    selector: { type: String },
    html: { type: String },
    screenshotId: { type: Schema.Types.ObjectId, ref: "Screenshot" },
    status: { type: String, enum: ["open", "accepted", "ignored", "fixed"], default: "open" },
  },
  { timestamps: true },
);

accessibilityIssueSchema.index({ testRunId: 1, createdAt: -1 });
accessibilityIssueSchema.index({ projectId: 1, impact: 1 });

export const AccessibilityIssue = mongoose.model("AccessibilityIssue", accessibilityIssueSchema);
