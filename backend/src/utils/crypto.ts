import crypto from "node:crypto";
import { loadEnv } from "../config/env.js";

function keyBuffer() {
  const raw = loadEnv().ENCRYPTION_KEY;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", keyBuffer(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSecret(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(":");
  if (!ivHex || !tagHex || !dataHex) throw new Error("Invalid encrypted payload");
  const decipher = crypto.createDecipheriv("aes-256-gcm", keyBuffer(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

export const SENSITIVE_HEADER_KEYS = [
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "api-key",
  "x-auth-token",
  "proxy-authorization",
];

export const SENSITIVE_BODY_KEYS = [
  "password",
  "passwd",
  "secret",
  "token",
  "accessToken",
  "refreshToken",
  "apiKey",
  "api_key",
  "authorization",
  "cookie",
  "session",
  "sessionSecret",
  "creditCard",
  "ssn",
];

export function sanitizeHeaders(headers: Record<string, string | string[] | undefined>) {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value == null) continue;
    const joined = Array.isArray(value) ? value.join(", ") : String(value);
    out[key] = SENSITIVE_HEADER_KEYS.includes(key.toLowerCase()) ? "[REDACTED]" : joined;
  }
  return out;
}

export function sanitizeBody(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeBody);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_BODY_KEYS.includes(key) ? "[REDACTED]" : sanitizeBody(nested);
    }
    return out;
  }
  return value;
}

export function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  if (!user || !domain) return email;
  return `${user.slice(0, 1)}***@${domain}`;
}
