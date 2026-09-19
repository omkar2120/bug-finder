import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { PasswordReset } from "../models/PasswordReset.js";
import { AuditLog } from "../models/AuditLog.js";
import { AppError, conflict, unauthorized, validationError } from "../utils/AppError.js";
import { hashToken, randomToken } from "../utils/crypto.js";
import { loadEnv } from "../config/env.js";
import { issueRefreshToken, revokeRefreshToken, rotateRefreshToken, signAccessToken } from "./tokenService.js";

const SALT_ROUNDS = 12;

function publicUser(user: { id: string; name: string; email: string; role: string; createdAt?: Date }) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

export class AuthService {
  async register(input: { name: string; email: string; password: string; role?: "admin" | "qa_engineer" | "viewer" }) {
    const existing = await User.findOne({ email: input.email.toLowerCase() });
    if (existing) throw conflict("An account with this email already exists");

    const count = await User.countDocuments();
    const role = count === 0 ? "admin" : input.role ?? "qa_engineer";
    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    const user = await User.create({
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash,
      role,
    });

    await AuditLog.create({
      actorId: user._id,
      action: "auth.register",
      resourceType: "user",
      resourceId: String(user._id),
    });

    return this.issueSession({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  }

  async login(input: { email: string; password: string; userAgent?: string; ip?: string }) {
    const user = await User.findOne({ email: input.email.toLowerCase() });
    if (!user) throw unauthorized("Invalid email or password");
    const match = await bcrypt.compare(input.password, user.passwordHash);
    if (!match) throw unauthorized("Invalid email or password");
    user.lastLoginAt = new Date();
    await user.save();
    await AuditLog.create({
      actorId: user._id,
      action: "auth.login",
      resourceType: "user",
      resourceId: String(user._id),
      ip: input.ip,
    });
    return this.issueSession(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      input.userAgent,
      input.ip,
    );
  }

  async refresh(refreshToken: string | undefined, userAgent?: string, ip?: string) {
    if (!refreshToken) throw unauthorized("Refresh token required");
    const rotated = await rotateRefreshToken(refreshToken, userAgent, ip);
    if (!rotated) throw unauthorized("Invalid or expired refresh token");
    const user = await User.findById(rotated.userId);
    if (!user) throw unauthorized("User no longer exists");
    return {
      user: publicUser({ id: user.id, name: user.name, email: user.email, role: user.role }),
      accessToken: signAccessToken({
        sub: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      }),
      refreshToken: rotated.refreshToken,
    };
  }

  async logout(refreshToken?: string) {
    if (refreshToken) await revokeRefreshToken(refreshToken);
  }

  async me(userId: string) {
    const user = await User.findById(userId);
    if (!user) throw unauthorized("User no longer exists");
    return publicUser({ id: user.id, name: user.name, email: user.email, role: user.role });
  }

  async forgotPassword(email: string) {
    const user = await User.findOne({ email: email.toLowerCase() });
    const env = loadEnv();
    if (!user) {
      return { message: "If an account exists, a reset link has been created." };
    }
    const token = randomToken(32);
    await PasswordReset.create({
      userId: user._id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    await AuditLog.create({
      actorId: user._id,
      action: "auth.forgot_password",
      resourceType: "user",
      resourceId: String(user._id),
    });
    return {
      message: "If an account exists, a reset link has been created.",
      ...(env.NODE_ENV !== "production"
        ? { resetToken: token, resetUrl: `${env.FRONTEND_URL}/reset-password?token=${token}` }
        : {}),
    };
  }

  async resetPassword(token: string, password: string) {
    const record = await PasswordReset.findOne({ tokenHash: hashToken(token), usedAt: { $exists: false } });
    if (!record || record.expiresAt.getTime() < Date.now()) {
      throw new AppError(400, "INVALID_TOKEN", "Reset token is invalid or expired");
    }
    const user = await User.findById(record.userId);
    if (!user) throw validationError("User not found");
    user.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await user.save();
    record.usedAt = new Date();
    await record.save();
    return { message: "Password updated. You can now sign in." };
  }

  private async issueSession(user: { id: string; name: string; email: string; role: "admin" | "qa_engineer" | "viewer" }, userAgent?: string, ip?: string) {
    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });
    const refreshToken = await issueRefreshToken(user.id, userAgent, ip);
    return {
      user: publicUser(user),
      accessToken,
      refreshToken,
    };
  }
}

export const authService = new AuthService();
