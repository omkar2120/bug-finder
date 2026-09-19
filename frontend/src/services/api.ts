const API = "/api/v1";

let accessToken = localStorage.getItem("bp_access") ?? "";
let refreshToken = localStorage.getItem("bp_refresh") ?? "";

export function setTokens(access?: string, refresh?: string) {
  accessToken = access ?? "";
  refreshToken = refresh ?? "";
  if (access) localStorage.setItem("bp_access", access);
  else localStorage.removeItem("bp_access");
  if (refresh) localStorage.setItem("bp_refresh", refresh);
  else localStorage.removeItem("bp_refresh");
}

export function getAccessToken() {
  return accessToken;
}

async function parse(res: Response) {
  const json = await res.json().catch(() => ({ success: false, error: { message: res.statusText } }));
  if (!res.ok || json.success === false) {
    throw new Error(json.error?.message || "Request failed");
  }
  return json;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<{ data: T; meta?: Record<string, unknown> }> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  let res = await fetch(`${API}${path}`, { ...init, headers, credentials: "include" });
  if (res.status === 401 && refreshToken && !path.startsWith("/auth/")) {
    const refreshed = await fetch(`${API}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ refreshToken }),
    });
    if (refreshed.ok) {
      const body = await refreshed.json();
      setTokens(body.data.accessToken, body.data.refreshToken);
      headers.set("Authorization", `Bearer ${body.data.accessToken}`);
      res = await fetch(`${API}${path}`, { ...init, headers, credentials: "include" });
    }
  }
  return parse(res);
}

export async function openAuthedFile(path: string) {
  const res = await fetch(`/api/v1${path}`, {
    headers: { Authorization: `Bearer ${getAccessToken()}` },
    credentials: "include",
  });
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener");
}

export const authApi = {
  register: (body: object) => api("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body: object) => api("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  logout: () => api("/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken }) }),
  me: () => api("/auth/me"),
  forgot: (email: string) => api("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),
  reset: (body: object) => api("/auth/reset-password", { method: "POST", body: JSON.stringify(body) }),
};
