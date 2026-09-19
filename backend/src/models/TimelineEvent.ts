import mongoose, { Schema } from "mongoose";

const timelineEventSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    testRunId: { type: Schema.Types.ObjectId, ref: "TestRun", required: true, index: true },
    type: { type: String, required: true },
    message: { type: String, required: true },
    level: { type: String, enum: ["info", "success", "warning", "error", "ai"], default: "info" },
    payload: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

timelineEventSchema.index({ testRunId: 1, createdAt: 1 });

export const TimelineEvent = mongoose.model("TimelineEvent", timelineEventSchema);
