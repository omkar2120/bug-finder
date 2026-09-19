import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { resetEnvCache } from "../src/config/env.js";

let app: Awaited<ReturnType<typeof import("../src/app.js")["createApp"]>>;
let mongo: MongoMemoryServer | undefined;

describe("auth and project APIs", () => {
  beforeAll(async () => {
    try {
      mongo = await MongoMemoryServer.create();
      process.env.MONGODB_URI = mongo.getUri();
    } catch {
      process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/bugpilot-test";
    }
    process.env.NODE_ENV = "test";
    process.env.REDIS_URL = "redis://127.0.0.1:6379";
    process.env.JWT_ACCESS_SECRET = "test-access-secret-value-32";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret-value-32";
    process.env.ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    process.env.AI_SERVICE_SECRET = "test-ai-secret";
    process.env.FRONTEND_URL = "http://localhost:5173";
    resetEnvCache();
    await mongoose.connect(process.env.MONGODB_URI);
    const { createApp } = await import("../src/app.js");
    app = createApp();
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  });

  it("registers, authenticates, and persists a project", async () => {
    const register = await request(app).post("/api/v1/auth/register").send({
      name: "Ada QA",
      email: "ada@bugpilot.test",
      password: "Password123!",
    });
    expect(register.status).toBe(201);
    expect(register.body.success).toBe(true);
    expect(register.body.data.user.role).toBe("admin");
    const token = register.body.data.accessToken as string;

    const me = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe("ada@bugpilot.test");

    const created = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Checkout Lab",
        description: "Authorized staging app",
        applicationUrl: "https://demo.bugpilot.test",
        environment: "qa",
        allowedDomains: ["demo.bugpilot.test"],
        maxPages: 10,
        maxDepth: 2,
        maxDurationSeconds: 120,
        browser: "chromium",
        testConcurrency: 1,
        requirements: [{ text: "Checkout must reject negative quantities", priority: "high" }],
        acknowledgedAuthorization: true,
      });
    expect(created.status).toBe(201);
    expect(created.body.data.application.baseUrl).toBe("https://demo.bugpilot.test");

    const listed = await request(app).get("/api/v1/projects").set("Authorization", `Bearer ${token}`);
    expect(listed.body.data).toHaveLength(1);
    expect(listed.body.meta.total).toBe(1);

    const dashboard = await request(app).get("/api/v1/dashboard").set("Authorization", `Bearer ${token}`);
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.data.totals.totalProjects).toBe(1);
    expect(dashboard.body.data.totals.totalBugs).toBe(0);
  });
});
