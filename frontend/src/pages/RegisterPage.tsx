import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi, setTokens } from "@/services/api";
import { useAuth } from "@/stores/auth";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function RegisterPage() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const res = await authApi.register({
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
      });
      setTokens((res.data as any).accessToken, (res.data as any).refreshToken);
      setUser((res.data as any).user);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to register");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your BugPilot workspace</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Work email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" minLength={8} required />
          </div>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <Button className="w-full">Create account</Button>
          <p className="text-sm text-muted-foreground">
            Already registered? <Link to="/login">Sign in</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
