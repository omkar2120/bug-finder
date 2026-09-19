import fs from "node:fs/promises";
import path from "node:path";
import { loadEnv } from "../config/env.js";

export interface StoredObject {
  provider: "local" | "s3";
  key: string;
}

export interface StorageProvider {
  put(key: string, data: Buffer, contentType?: string): Promise<StoredObject>;
  get(key: string): Promise<Buffer>;
  exists(key: string): Promise<boolean>;
}

class LocalStorageProvider implements StorageProvider {
  constructor(private readonly root: string) {}

  private resolve(key: string) {
    const safe = key.replace(/\.\./g, "");
    return path.join(this.root, safe);
  }

  async put(key: string, data: Buffer): Promise<StoredObject> {
    const full = this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
    return { provider: "local", key };
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFile(this.resolve(key));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }
}

class S3ReadyStorageProvider implements StorageProvider {
  constructor(private readonly fallback: LocalStorageProvider) {}

  async put(key: string, data: Buffer, contentType?: string) {
    // Production hook: swap this implementation for an S3 SDK client.
    // Local development continues to persist to the filesystem.
    return this.fallback.put(key, data);
  }

  get(key: string) {
    return this.fallback.get(key);
  }

  exists(key: string) {
    return this.fallback.exists(key);
  }
}

let cached: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (cached) return cached;
  const env = loadEnv();
  const local = new LocalStorageProvider(path.resolve(env.STORAGE_PATH));
  cached = env.STORAGE_PROVIDER === "s3" ? new S3ReadyStorageProvider(local) : local;
  return cached;
}

export function resetStorageCache() {
  cached = null;
}
