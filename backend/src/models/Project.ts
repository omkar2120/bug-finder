import mongoose, { Schema, type InferSchemaType } from "mongoose";

const requirementSchema = new Schema(
  {
    text: { type: String, required: true },
    priority: { type: String, enum: ["critical", "high", "medium", "low"], default: "medium" },
  },
  { _id: true },
);

const memberSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["owner", "qa_engineer", "viewer"], required: true },
  },
  { _id: false },
);

const projectSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    application: {
      type: {
        baseUrl: { type: String, required: true },
        allowedDomains: { type: [String], required: true },
        environment: {
          type: String,
          enum: ["prod", "qa", "uat", "development", "staging", "production", "custom"],
          default: "qa",
        },
        prodUrl: { type: String, default: "" },
        qaUrl: { type: String, default: "" },
        uatUrl: { type: String, default: "" },
      },
      required: true,
    },
    testingConfig: {
      type: {
        maxPages: { type: Number, default: 25 },
        maxDepth: { type: Number, default: 3 },
        maxDurationSeconds: { type: Number, default: 300 },
        browser: { type: String, enum: ["chromium", "firefox", "webkit"], default: "chromium" },
        headless: { type: Boolean, default: true },
        testConcurrency: { type: Number, default: 1 },
        captureScreenshots: { type: Boolean, default: false },
      },
      required: true,
    },
    requirements: { type: [requirementSchema], default: [] },
    credentialsConfigured: { type: Boolean, default: false },
    status: { type: String, enum: ["active", "archived"], default: "active", index: true },
    members: { type: [memberSchema], default: [] },
    bugSequence: { type: Number, default: 0 },
  },
  { timestamps: true },
);

projectSchema.index({ ownerId: 1, createdAt: -1 });
projectSchema.index({ "members.userId": 1, status: 1 });
projectSchema.index({ status: 1, createdAt: -1 });

export type ProjectDocument = InferSchemaType<typeof projectSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const Project = mongoose.model("Project", projectSchema);
