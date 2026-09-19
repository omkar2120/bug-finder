const HEADER_KEYS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "api-key",
  "x-auth-token",
  "proxy-authorization",
]);

const BODY_KEYS = new Set([
  "password",
  "passwd",
  "secret",
  "token",
  "accesstoken",
  "refreshtoken",
  "apikey",
  "api_key",
  "authorization",
  "cookie",
  "session",
  "sessionsecret",
]);

export function sanitizeHeaders(headers: Record<string, string>) {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    out[key] = HEADER_KEYS.has(key.toLowerCase()) ? "[REDACTED]" : value;
  }
  return out;
}

export function sanitizeBody(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeBody);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = BODY_KEYS.has(key.toLowerCase()) ? "[REDACTED]" : sanitizeBody(nested);
    }
    return out;
  }
  return value;
}

export function tryParseBody(raw: string | undefined) {
  if (!raw) return undefined;
  try {
    return sanitizeBody(JSON.parse(raw));
  } catch {
    return raw.length > 4000 ? `${raw.slice(0, 4000)}…` : raw;
  }
}

export function classifyHttpResult(status?: number, failed?: boolean, timeout?: boolean) {
  if (timeout) return "timeout" as const;
  if (failed && !status) return "network_error" as const;
  if (!status) return "network_error" as const;
  if (status >= 500) return "server_error" as const;
  if (status >= 400) return "client_error" as const;
  return "success" as const;
}

export function endpointFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.pathname;
  } catch {
    return url;
  }
}
