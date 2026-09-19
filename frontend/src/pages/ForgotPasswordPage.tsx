import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { authApi } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ForgotPasswordPage() {
  const [message, setMessage] = useState("");
  const [resetUrl, setResetUrl] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const res = await authApi.forgot(String(form.get("email")));
    setMessage((res.data as any).message);
    setResetUrl((res.data as any).resetUrl ?? "");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset your password</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <Button className="w-full">Send reset link</Button>
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          {resetUrl ? (
            <p className="text-sm">
              Development reset link: <Link to={resetUrl.replace(window.location.origin, "")}>{resetUrl}</Link>
            </p>
          ) : null}
          <Link className="text-sm text-muted-foreground" to="/login">
            Back to sign in
          </Link>
        </form>
      </CardContent>
    </Card>
  );
}
