export const APP_ENVS = ["prod", "qa", "uat"] as const;
export type AppEnv = (typeof APP_ENVS)[number];

export type EnvironmentUrls = Record<AppEnv, { url: string }>;

export function hostnameFromUrl(value: string) {
  return new URL(value).hostname.toLowerCase();
}

export function hostnameFromUrlSafe(value: string) {
  try {
    return hostnameFromUrl(value);
  } catch {
    return "";
  }
}

export function normalizeDomain(value: string) {
  return value.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
}

export function defaultAllowedDomains(applicationUrl: string) {
  const host = hostnameFromUrlSafe(applicationUrl);
  return host ? [host] : [];
}

export function normalizeEnv(value?: string | null): AppEnv {
  const env = String(value || "").trim().toLowerCase();
  if (env === "prod" || env === "production") return "prod";
  if (env === "uat" || env === "development") return "uat";
  return "qa";
}

export function emptyEnvironments(): EnvironmentUrls {
  return { prod: { url: "" }, qa: { url: "" }, uat: { url: "" } };
}

export function readEnvironments(application: {
  baseUrl?: string;
  environment?: string;
  prodUrl?: string;
  qaUrl?: string;
  uatUrl?: string;
  environments?: Partial<Record<AppEnv, { url?: string } | string>>;
}): EnvironmentUrls {
  const environments = emptyEnvironments();
  const flat: Record<AppEnv, string | undefined> = {
    prod: application.prodUrl,
    qa: application.qaUrl,
    uat: application.uatUrl,
  };
  for (const key of APP_ENVS) {
    const raw = application.environments?.[key];
    const nested = typeof raw === "string" ? raw : raw?.url;
    environments[key].url = String(nested || flat[key] || "").trim();
  }
  const fallback = String(application.baseUrl || "").trim();
  const current = normalizeEnv(application.environment);
  if (fallback && !environments[current].url) {
    environments[current].url = fallback;
  }
  if (fallback && !APP_ENVS.some((key) => environments[key].url)) {
    environments[current].url = fallback;
  }
  return environments;
}

export function firstEnvironmentUrl(environments: EnvironmentUrls, preferred?: AppEnv) {
  if (preferred && environments[preferred].url) return environments[preferred].url;
  for (const key of APP_ENVS) {
    if (environments[key].url) return environments[key].url;
  }
  return "";
}

export function hostsFromEnvironments(environments: EnvironmentUrls) {
  return APP_ENVS.map((key) => hostnameFromUrlSafe(environments[key].url)).filter(Boolean);
}

export function resolveRunTarget(
  application: {
    baseUrl?: string;
    environment?: string;
    allowedDomains?: string[];
    prodUrl?: string;
    qaUrl?: string;
    uatUrl?: string;
    environments?: Partial<Record<AppEnv, { url?: string } | string>>;
  },
  requestedEnv?: string,
) {
  const environments = readEnvironments(application);
  const environment = normalizeEnv(requestedEnv || application.environment);
  const baseUrl = firstEnvironmentUrl(environments, environment);
  const allowed = new Set((application.allowedDomains ?? []).map(normalizeDomain).filter(Boolean));
  for (const host of hostsFromEnvironments(environments)) allowed.add(host);
  if (baseUrl) {
    const host = hostnameFromUrlSafe(baseUrl);
    if (host) allowed.add(host);
  }
  return {
    environment,
    baseUrl,
    environments,
    allowedDomains: [...allowed],
  };
}

export function isUrlAllowed(url: string, allowedDomains: string[]) {
  let hostname: string;
  try {
    hostname = hostnameFromUrl(url);
  } catch {
    return false;
  }
  return allowedDomains.some((domain) => {
    const normalized = normalizeDomain(domain);
    return hostname === normalized || hostname.endsWith(`.${normalized}`);
  });
}

export function assertAuthorizedUrl(url: string, allowedDomains: string[]) {
  if (!isUrlAllowed(url, allowedDomains)) {
    throw new Error(`URL is outside the authorized domains: ${url}`);
  }
}
