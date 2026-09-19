import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { BrandMark } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/stores/auth";
import { authApi, setTokens } from "@/services/api";
import { useEffect, useState } from "react";

const links = [
  { to: "/dashboard", label: "Overview" },
  { to: "/projects", label: "Projects" },
];

export function AppLayout() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [theme, setTheme] = useState(document.documentElement.classList.contains("light") ? "light" : "dark");

  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
  }, [theme]);

  async function logout() {
    await authApi.logout().catch(() => undefined);
    setTokens();
    setUser(null);
    navigate("/login");
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-8">
            <BrandMark compact />
            <nav className="flex gap-4 text-sm">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    isActive ? "font-medium text-primary" : "text-muted-foreground hover:text-foreground"
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? "Light" : "Dark"}
            </Button>
            <div className="hidden text-right text-xs sm:block">
              <div className="font-medium">{user?.name}</div>
              <div className="text-muted-foreground">{user?.role}</div>
            </div>
            <Button variant="outline" size="sm" onClick={logout}>
              Logout
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
