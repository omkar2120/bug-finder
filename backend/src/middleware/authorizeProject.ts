import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { Project } from "../models/Project.js";
import { fail } from "../utils/apiResponse.js";
import { routeParam } from "../utils/params.js";

type ProjectRole = "owner" | "qa_engineer" | "viewer";

const WRITE_ROLES: ProjectRole[] = ["owner", "qa_engineer"];
const MANAGE_ROLES: ProjectRole[] = ["owner"];

export function authorizeProject(action: "read" | "write" | "manage" = "read") {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return fail(res, 401, "UNAUTHORIZED", "Authentication required");

    const projectId = routeParam(req, "projectId");
    if (!projectId || !mongoose.isValidObjectId(projectId)) {
      return fail(res, 400, "VALIDATION_ERROR", "Invalid project id");
    }

    const project = await Project.findById(projectId);
    if (!project) return fail(res, 404, "NOT_FOUND", "Project not found");

    if (req.user.role === "admin") {
      req.project = { id: project.id, ownerId: project.ownerId, memberRole: "admin" };
      return next();
    }

    const member = project.members.find((m) => String(m.userId) === req.user!.id);
    const isOwner = String(project.ownerId) === req.user.id;
    const role: ProjectRole | undefined = isOwner ? "owner" : member?.role;
    if (!role) return fail(res, 403, "FORBIDDEN", "You do not have access to this project");

    if (action === "write" && !WRITE_ROLES.includes(role)) {
      return fail(res, 403, "FORBIDDEN", "You do not have permission to modify this project");
    }
    if (action === "manage" && !MANAGE_ROLES.includes(role)) {
      return fail(res, 403, "FORBIDDEN", "Only the project owner can manage this project");
    }

    req.project = { id: project.id, ownerId: project.ownerId, memberRole: role };
    return next();
  };
}
