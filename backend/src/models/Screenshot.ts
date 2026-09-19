import mongoose, { Schema } from "mongoose";

const screenshotSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    testRunId: { type: Schema.Types.ObjectId, ref: "TestRun", required: true, index: true },
    testResultId: { type: Schema.Types.ObjectId, ref: "TestResult" },
    bugId: { type: Schema.Types.ObjectId, ref: "Bug" },
    storage: {
      provider: { type: String, enum: ["local", "s3"], required: true },
      key: { type: String, required: true },
    },
    metadata: {
      width: { type: Number, required: true },
      height: { type: Number, required: true },
      pageUrl: { type: String },
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

screenshotSchema.index({ testRunId: 1, createdAt: -1 });
screenshotSchema.index({ projectId: 1, createdAt: -1 });

export const Screenshot = mongoose.model("Screenshot", screenshotSchema);
