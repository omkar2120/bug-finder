export function normalizeDomain(value: string) {
  return value.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase();
}

export function hostnameOf(url: string) {
  return new URL(url).hostname.toLowerCase();
}

export function isAllowedUrl(url: string, allowedDomains: string[]) {
  try {
    const hostname = hostnameOf(url);
    return allowedDomains.some((domain) => {
      const normalized = normalizeDomain(domain);
      return hostname === normalized || hostname.endsWith(`.${normalized}`);
    });
  } catch {
    return false;
  }
}

export function canonicalizeUrl(url: string) {
  const parsed = new URL(url);
  parsed.hash = "";
  if (parsed.pathname.endsWith("/") && parsed.pathname !== "/") {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }
  return parsed.toString();
}
