import jwt from "jsonwebtoken";
import { loadEnv } from "../config/env.js";
import { hashToken, randomToken } from "../utils/crypto.js";
import { RefreshToken } from "../models/RefreshToken.js";
import type { AccessPayload } from "../middleware/auth.js";

export function signAccessToken(payload: AccessPayload) {
  const env = loadEnv();
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

export async function issueRefreshToken(userId: string, userAgent?: string, ip?: string) {
  const env = loadEnv();
  const token = randomToken(48);
  const days = env.JWT_REFRESH_EXPIRES_IN.endsWith("d")
    ? Number(env.JWT_REFRESH_EXPIRES_IN.slice(0, -1)) || 7
    : 7;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  await RefreshToken.create({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
    userAgent,
    ip,
  });
  return token;
}

export async function rotateRefreshToken(token: string, userAgent?: string, ip?: string) {
  const existing = await RefreshToken.findOne({ tokenHash: hashToken(token), revokedAt: { $exists: false } });
  if (!existing || existing.expiresAt.getTime() < Date.now()) {
    return null;
  }
  existing.revokedAt = new Date();
  await existing.save();
  const next = await issueRefreshToken(String(existing.userId), userAgent, ip);
  return { userId: String(existing.userId), refreshToken: next };
}

export async function revokeRefreshToken(token: string) {
  await RefreshToken.updateOne({ tokenHash: hashToken(token) }, { $set: { revokedAt: new Date() } });
}

export async function revokeAllUserTokens(userId: string) {
  await RefreshToken.updateMany({ userId, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
}
