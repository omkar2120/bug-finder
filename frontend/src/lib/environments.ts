export const APP_ENVS = ["prod", "qa", "uat"] as const;
export type AppEnv = (typeof APP_ENVS)[number];

export const ENV_LABELS: Record<AppEnv, string> = {
  prod: "PROD",
  qa: "QA",
  uat: "UAT",
};

export function normalizeEnv(value?: string | null): AppEnv {
  const env = String(value || "").trim().toLowerCase();
  if (env === "prod" || env === "production") return "prod";
  if (env === "uat" || env === "development") return "uat";
  return "qa";
}

export function envUrls(application?: {
  baseUrl?: string;
  environment?: string;
  prodUrl?: string;
  qaUrl?: string;
  uatUrl?: string;
  environments?: Partial<Record<AppEnv, { url?: string }>>;
}) {
  const current = normalizeEnv(application?.environment);
  const urls = {
    prod: application?.environments?.prod?.url?.trim() || application?.prodUrl?.trim() || "",
    qa: application?.environments?.qa?.url?.trim() || application?.qaUrl?.trim() || "",
    uat: application?.environments?.uat?.url?.trim() || application?.uatUrl?.trim() || "",
  };
  if (application?.baseUrl && !urls[current]) {
    urls[current] = application.baseUrl;
  }
  if (application?.baseUrl && !urls.prod && !urls.qa && !urls.uat) {
    urls[current] = application.baseUrl;
  }
  return urls;
}

export function envUrl(
  application: Parameters<typeof envUrls>[0],
  environment?: string,
) {
  const urls = envUrls(application);
  const key = normalizeEnv(environment || application?.environment);
  return urls[key] || urls.prod || urls.qa || urls.uat || application?.baseUrl || "";
}
