import { beforeEach, describe, expect, it } from "vitest";
import { encryptSecret, decryptSecret, sanitizeBody, sanitizeHeaders } from "../src/utils/crypto.js";
import { resetEnvCache } from "../src/config/env.js";

describe("secret encryption and sanitization", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/bugpilot-test";
    process.env.REDIS_URL = "redis://127.0.0.1:6379";
    process.env.JWT_ACCESS_SECRET = "test-access-secret-value-32";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret-value-32";
    process.env.ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    process.env.AI_SERVICE_SECRET = "test-ai-secret";
    process.env.FRONTEND_URL = "http://localhost:5173";
    resetEnvCache();
  });

  it("round-trips encrypted credentials", () => {
    const encrypted = encryptSecret("super-secret");
    expect(encrypted).not.toContain("super-secret");
    expect(decryptSecret(encrypted)).toBe("super-secret");
  });

  it("redacts secrets from headers and bodies", () => {
    expect(sanitizeHeaders({ Authorization: "Bearer abc", Accept: "application/json" }).Authorization).toBe("[REDACTED]");
    expect((sanitizeBody({ password: "x", email: "a@b.com" }) as { password: string }).password).toBe("[REDACTED]");
  });
});
