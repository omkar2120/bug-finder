import type { Types } from "mongoose";

declare global {
  namespace Express {
    interface Request {
      params: Record<string, string>;
      user?: {
        id: string;
        email: string;
        role: "admin" | "qa_engineer" | "viewer";
        name: string;
      };
      project?: {
        id: string;
        ownerId: Types.ObjectId;
        memberRole: "owner" | "qa_engineer" | "viewer" | "admin";
      };
    }
  }
}

export {};
