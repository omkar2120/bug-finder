import mongoose, { Schema } from "mongoose";

const stepSchema = new Schema(
  {
    order: { type: Number, required: true },
    action: {
      type: String,
      enum: ["navigate", "click", "type", "select", "submit", "wait", "assert"],
      required: true,
    },
    target: { type: String },
    value: { type: String },
    expected: { type: String },
  },
  { _id: false },
);

const testCaseSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    testRunId: { type: Schema.Types.ObjectId, ref: "TestRun", required: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    type: {
      type: String,
      enum: [
        "functional",
        "negative",
        "boundary",
        "validation",
        "navigation",
        "session",
        "api",
        "accessibility",
        "content",
      ],
      required: true,
    },
    priority: { type: String, enum: ["critical", "high", "medium", "low"], default: "medium" },
    preconditions: { type: [String], default: [] },
    steps: { type: [stepSchema], default: [] },
    expectedResult: { type: String, required: true },
    generatedBy: { type: String, enum: ["ai", "user"], default: "ai" },
    aiMetadata: {
      model: { type: String },
      confidence: { type: Number },
      reasoningSummary: { type: String },
    },
  },
  { timestamps: true },
);

testCaseSchema.index({ testRunId: 1, createdAt: 1 });
testCaseSchema.index({ projectId: 1, createdAt: -1 });

export const TestCase = mongoose.model("TestCase", testCaseSchema);
