import { useEffect, useMemo, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./routes/AppRoutes";
import { AuthContext, type AuthUser } from "./stores/auth";
import { authApi, getAccessToken, setTokens } from "./services/api";

const queryClient = new QueryClient();

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const value = useMemo(() => ({ user, setUser }), [user]);

  useEffect(() => {
    async function boot() {
      if (!getAccessToken()) {
        setReady(true);
        return;
      }
      try {
        const res = await authApi.me();
        setUser(res.data as AuthUser);
      } catch {
        setTokens();
      } finally {
        setReady(true);
      }
    }
    boot();
  }, []);

  if (!ready) {
    return <div className="p-8 text-sm text-muted-foreground">Loading BugPilot AI…</div>;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={value}>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}
