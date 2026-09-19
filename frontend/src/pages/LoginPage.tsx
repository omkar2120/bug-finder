import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi, setTokens } from "@/services/api";
import { useAuth } from "@/stores/auth";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginPage() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      const res = await authApi.login({
        email: form.get("email"),
        password: form.get("password"),
      });
      setTokens((res.data as any).accessToken, (res.data as any).refreshToken);
      setUser((res.data as any).user);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in to BugPilot AI</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">Work email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required />
          </div>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <Button className="w-full" disabled={pending}>
            {pending ? "Signing in…" : "Continue"}
          </Button>
          <div className="flex justify-between text-sm text-muted-foreground">
            <Link to="/forgot-password">Forgot password</Link>
            <Link to="/register">Create account</Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
