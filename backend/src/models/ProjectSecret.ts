import mongoose, { Schema } from "mongoose";

const projectSecretSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, unique: true },
    login: {
      usernameEncrypted: { type: String },
      passwordEncrypted: { type: String },
    },
    encryptionVersion: { type: Number, default: 1 },
  },
  { timestamps: true },
);

export const ProjectSecret = mongoose.model("ProjectSecret", projectSecretSchema);
