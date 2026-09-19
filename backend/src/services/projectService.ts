import { Project } from "../models/Project.js";
import { ProjectSecret } from "../models/ProjectSecret.js";
import { AuditLog } from "../models/AuditLog.js";
import { notFound, validationError } from "../utils/AppError.js";
import { encryptSecret } from "../utils/crypto.js";
import {
  firstEnvironmentUrl,
  hostnameFromUrl,
  hostsFromEnvironments,
  normalizeDomain,
  normalizeEnv,
  readEnvironments,
} from "./domainService.js";

function serializeProject(project: InstanceType<typeof Project>) {
  const environments = readEnvironments(project.application);
  const environment = normalizeEnv(project.application.environment);
  return {
    id: project.id,
    ownerId: String(project.ownerId),
    name: project.name,
    description: project.description,
    application: {
      baseUrl: firstEnvironmentUrl(environments, environment) || project.application.baseUrl,
      allowedDomains: project.application.allowedDomains,
      environment,
      environments,
    },
    testingConfig: project.testingConfig,
    requirements: project.requirements,
    credentialsConfigured: project.credentialsConfigured,
    status: project.status,
    members: project.members,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

function uniqueDomains(values: string[]) {
  return [...new Set(values.map(normalizeDomain).filter(Boolean))];
}

function mergeEnvironments(
  current: ReturnType<typeof readEnvironments>,
  input: {
    applicationUrl?: string;
    environment?: string;
    prodUrl?: string;
    qaUrl?: string;
    uatUrl?: string;
  },
) {
  const next = {
    prod: { url: current.prod.url },
    qa: { url: current.qa.url },
    uat: { url: current.uat.url },
  };
  if (typeof input.prodUrl === "string") next.prod.url = input.prodUrl.trim();
  if (typeof input.qaUrl === "string") next.qa.url = input.qaUrl.trim();
  if (typeof input.uatUrl === "string") next.uat.url = input.uatUrl.trim();
  const environment = normalizeEnv(input.environment);
  if (input.applicationUrl?.trim() && !next[environment].url) {
    next[environment].url = input.applicationUrl.trim();
  }
  return next;
}

function buildAllowedDomains(explicit: string[] | undefined, environments: ReturnType<typeof readEnvironments>, fallbackUrl?: string) {
  const hosts = [
    ...(explicit ?? []).map(normalizeDomain),
    ...hostsFromEnvironments(environments),
  ];
  if (fallbackUrl) {
    try {
      hosts.push(hostnameFromUrl(fallbackUrl));
    } catch {
      // ignore invalid fallback
    }
  }
  const allowed = uniqueDomains(hosts);
  if (!allowed.length) {
    throw validationError("Add at least one environment URL so BugPilot knows which domains are authorized");
  }
  return allowed;
}

export class ProjectService {
  async listForUser(userId: string, role: string, status?: string) {
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (role !== "admin") {
      filter.$or = [{ ownerId: userId }, { "members.userId": userId }];
    }
    const projects = await Project.find(filter).sort({ updatedAt: -1 });
    return projects.map(serializeProject);
  }

  async create(userId: string, input: {
    name: string;
    description?: string;
    applicationUrl?: string;
    environment?: string;
    prodUrl?: string;
    qaUrl?: string;
    uatUrl?: string;
    allowedDomains?: string[];
    maxPages: number;
    maxDepth: number;
    maxDurationSeconds: number;
    browser: "chromium" | "firefox" | "webkit";
    testConcurrency: number;
    headless?: boolean;
    captureScreenshots?: boolean;
    requirements: Array<{ text: string; priority: "critical" | "high" | "medium" | "low" }>;
    loginUsername?: string;
    loginPassword?: string;
  }) {
    const environment = normalizeEnv(input.environment);
    const environments = mergeEnvironments(
      { prod: { url: "" }, qa: { url: "" }, uat: { url: "" } },
      input,
    );
    const baseUrl = firstEnvironmentUrl(environments, environment);
    if (!baseUrl) {
      throw validationError("Add at least one environment URL (PROD, QA, or UAT)");
    }
    const allowedDomains = buildAllowedDomains(input.allowedDomains, environments, baseUrl);

    const project = await Project.create({
      ownerId: userId,
      name: input.name,
      description: input.description ?? "",
      application: {
        baseUrl,
        allowedDomains,
        environment,
        prodUrl: environments.prod.url,
        qaUrl: environments.qa.url,
        uatUrl: environments.uat.url,
      },
      testingConfig: {
        maxPages: input.maxPages,
        maxDepth: input.maxDepth,
        maxDurationSeconds: input.maxDurationSeconds,
        browser: input.browser,
        headless: input.headless !== false,
        testConcurrency: input.testConcurrency,
        captureScreenshots: Boolean(input.captureScreenshots),
      },
      requirements: input.requirements,
      credentialsConfigured: Boolean(input.loginUsername && input.loginPassword),
      members: [{ userId, role: "owner" }],
    });

    if (input.loginUsername && input.loginPassword) {
      await ProjectSecret.create({
        projectId: project._id,
        login: {
          usernameEncrypted: encryptSecret(input.loginUsername),
          passwordEncrypted: encryptSecret(input.loginPassword),
        },
        encryptionVersion: 1,
      });
    }

    await AuditLog.create({
      actorId: userId,
      action: "project.create",
      resourceType: "project",
      resourceId: project.id,
    });

    return serializeProject(project);
  }

  async getById(projectId: string) {
    const project = await Project.findById(projectId);
    if (!project) throw notFound("Project not found");
    return serializeProject(project);
  }

  async update(projectId: string, userId: string, input: Record<string, unknown>) {
    const project = await Project.findById(projectId);
    if (!project) throw notFound("Project not found");

    if (typeof input.name === "string") project.name = input.name;
    if (typeof input.description === "string") project.description = input.description;
    if (typeof input.status === "string") project.status = input.status as "active" | "archived";

    const envInput = {
      applicationUrl: typeof input.applicationUrl === "string" ? input.applicationUrl : undefined,
      environment: typeof input.environment === "string" ? input.environment : undefined,
      prodUrl: typeof input.prodUrl === "string" ? input.prodUrl : undefined,
      qaUrl: typeof input.qaUrl === "string" ? input.qaUrl : undefined,
      uatUrl: typeof input.uatUrl === "string" ? input.uatUrl : undefined,
    };
    const touchedEnv =
      envInput.applicationUrl !== undefined ||
      envInput.environment !== undefined ||
      envInput.prodUrl !== undefined ||
      envInput.qaUrl !== undefined ||
      envInput.uatUrl !== undefined ||
      Array.isArray(input.allowedDomains);

    if (touchedEnv) {
      const environments = mergeEnvironments(readEnvironments(project.application), envInput);
      const environment = normalizeEnv(envInput.environment || project.application.environment);
      const baseUrl = firstEnvironmentUrl(environments, environment);
      if (!baseUrl) {
        throw validationError("Add at least one environment URL (PROD, QA, or UAT)");
      }
      project.application.environment = environment;
      project.application.prodUrl = environments.prod.url;
      project.application.qaUrl = environments.qa.url;
      project.application.uatUrl = environments.uat.url;
      project.application.baseUrl = baseUrl;
      project.application.allowedDomains = buildAllowedDomains(
        Array.isArray(input.allowedDomains) ? (input.allowedDomains as string[]) : project.application.allowedDomains,
        environments,
        baseUrl,
      );
    }

    const config = project.testingConfig;
    if (typeof input.maxPages === "number") config.maxPages = input.maxPages;
    if (typeof input.maxDepth === "number") config.maxDepth = input.maxDepth;
    if (typeof input.maxDurationSeconds === "number") config.maxDurationSeconds = input.maxDurationSeconds;
    if (typeof input.browser === "string") config.browser = input.browser as typeof config.browser;
    if (typeof input.testConcurrency === "number") config.testConcurrency = input.testConcurrency;
    if (typeof input.headless === "boolean") config.headless = input.headless;
    if (typeof input.captureScreenshots === "boolean") config.captureScreenshots = input.captureScreenshots;
    if (Array.isArray(input.requirements)) {
      project.requirements = input.requirements as typeof project.requirements;
    }

    if (typeof input.loginUsername === "string" && typeof input.loginPassword === "string") {
      await ProjectSecret.findOneAndUpdate(
        { projectId: project._id },
        {
          login: {
            usernameEncrypted: encryptSecret(input.loginUsername),
            passwordEncrypted: encryptSecret(input.loginPassword),
          },
          encryptionVersion: 1,
        },
        { upsert: true },
      );
      project.credentialsConfigured = true;
    }

    await project.save();
    await AuditLog.create({
      actorId: userId,
      action: "project.update",
      resourceType: "project",
      resourceId: project.id,
    });
    return serializeProject(project);
  }

  async archive(projectId: string, userId: string) {
    return this.update(projectId, userId, { status: "archived" });
  }
}

export const projectService = new ProjectService();
