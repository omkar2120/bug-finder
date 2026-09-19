import mongoose, { Schema } from "mongoose";

const reportSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    testRunId: { type: Schema.Types.ObjectId, ref: "TestRun" },
    type: {
      type: String,
      enum: ["full_qa", "test", "bug", "api", "content", "accessibility", "performance"],
      required: true,
    },
    format: { type: String, enum: ["html", "json"], required: true },
    title: { type: String, required: true },
    storage: {
      provider: { type: String, enum: ["local", "s3"], required: true },
      key: { type: String, required: true },
    },
    generatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    summary: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

reportSchema.index({ projectId: 1, createdAt: -1 });

export const Report = mongoose.model("Report", reportSchema);
