import mongoose from "mongoose";
import { loadEnv } from "./env.js";
import { logger } from "../utils/logger.js";

export async function connectDatabase(uri?: string) {
  const env = loadEnv();
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri ?? env.MONGODB_URI);
  logger.info("Connected to MongoDB");
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
