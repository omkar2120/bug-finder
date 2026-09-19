import mongoose, { Schema } from "mongoose";

const auditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User" },
    action: { type: String, required: true },
    resourceType: { type: String, required: true },
    resourceId: { type: String },
    metadata: { type: Schema.Types.Mixed },
    ip: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1 });

export const AuditLog = mongoose.model("AuditLog", auditLogSchema);
