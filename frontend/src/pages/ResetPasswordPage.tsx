import { FormEvent, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authApi } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const res = await authApi.reset({
      token: params.get("token") || form.get("token"),
      password: form.get("password"),
    });
    setMessage((res.data as any).message);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose a new password</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <Input name="token" defaultValue={params.get("token") ?? ""} placeholder="Reset token" required />
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input id="password" name="password" type="password" minLength={8} required />
          </div>
          <Button className="w-full">Update password</Button>
          {message ? (
            <p className="text-sm">
              {message} <Link to="/login">Sign in</Link>
            </p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
