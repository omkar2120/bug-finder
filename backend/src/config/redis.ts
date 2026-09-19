import { Redis } from "ioredis";
import { loadEnv } from "./env.js";
import { logger } from "../utils/logger.js";

let client: Redis | null = null;

export function getRedis(): Redis {
  if (client) return client;
  const env = loadEnv();
  client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: true,
    retryStrategy(times) {
      if (times > 8) return null;
      return Math.min(times * 200, 2000);
    },
  });
  client.on("error", (error) => {
    logger.warn("Redis connection error", { message: error.message });
  });
  return client;
}

export async function pingRedis(timeoutMs = 800) {
  const redis = getRedis();
  const timeout = (label: string) =>
    new Promise((_, reject) => setTimeout(() => reject(new Error(label)), timeoutMs));
  try {
    if (redis.status === "wait") {
      await Promise.race([redis.connect(), timeout("Redis connect timeout")]);
    }
    return await Promise.race([redis.ping(), timeout("Redis ping timeout")]);
  } catch (error) {
    await redis.disconnect().catch(() => undefined);
    client = null;
    throw error;
  }
}

export async function closeRedis() {
  if (client) {
    await client.quit().catch(() => undefined);
    client = null;
  }
}
