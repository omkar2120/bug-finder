import { FormEvent, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_ENVS, ENV_LABELS, envUrls, normalizeEnv } from "@/lib/environments";

export function ProjectFormPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const existing = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => api<any>(`/projects/${projectId}`),
    enabled: Boolean(projectId),
  });
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: (body: object) =>
      api(projectId ? `/projects/${projectId}` : "/projects", {
        method: projectId ? "PATCH" : "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: (res) => navigate(`/projects/${(res.data as any).id}`),
    onError: (err: Error) => setError(err.message),
  });

  const project = existing.data?.data;
  const urls = envUrls(project?.application);
  const defaultEnv = normalizeEnv(project?.application?.environment);
  const extraDomains = (project?.application?.allowedDomains ?? []).filter((domain: string) => {
    const hosts = Object.values(urls).map((url) => {
      try {
        return new URL(url).hostname.toLowerCase();
      } catch {
        return "";
      }
    });
    return domain && !hosts.includes(domain.toLowerCase());
  });

  if (projectId && existing.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading project settings…</p>;
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const requirements = String(form.get("requirements") || "")
      .split("\n")
      .map((text) => text.trim())
      .filter(Boolean)
      .map((text) => ({ text, priority: "high" as const }));
    mutation.mutate({
      name: form.get("name"),
      description: form.get("description"),
      environment: form.get("environment"),
      prodUrl: form.get("prodUrl"),
      qaUrl: form.get("qaUrl"),
      uatUrl: form.get("uatUrl"),
      allowedDomains: String(form.get("allowedDomains") || "")
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean),
      maxPages: Number(form.get("maxPages")),
      maxDepth: Number(form.get("maxDepth")),
      maxDurationSeconds: Number(form.get("maxDurationSeconds")),
      browser: form.get("browser"),
      testConcurrency: Number(form.get("testConcurrency")),
      headless: form.get("watchBrowser") !== "on",
      captureScreenshots: form.get("captureScreenshots") === "on",
      requirements,
      loginUsername: form.get("loginUsername") || undefined,
      loginPassword: form.get("loginPassword") || undefined,
      acknowledgedAuthorization: true,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{projectId ? "Project settings" : "Create project"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
          <Field label="Project name" name="name" defaultValue={project?.name} required />
          <div>
            <Label>Default environment</Label>
            <select
              name="environment"
              defaultValue={defaultEnv}
              className="mt-2 h-10 w-full rounded-lg border bg-background px-3 text-sm"
            >
              {APP_ENVS.map((env) => (
                <option key={env} value={env}>
                  {ENV_LABELS[env]}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2 rounded-xl border p-4">
            <div className="text-sm font-medium">Environment URLs</div>
            <p className="mt-1 text-sm text-muted-foreground">
              PROD, QA, and UAT usually have different URLs. Save all three here, then pick which one to test when you start a run.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Field label="PROD URL" name="prodUrl" defaultValue={urls.prod} placeholder="https://app.example.com" />
              <Field label="QA URL" name="qaUrl" defaultValue={urls.qa} placeholder="https://qa.app.example.com" />
              <Field label="UAT URL" name="uatUrl" defaultValue={urls.uat} placeholder="https://uat.app.example.com" />
            </div>
          </div>
          <div className="md:col-span-2">
            <Label>Description</Label>
            <Textarea name="description" defaultValue={project?.description} className="mt-2" />
          </div>
          <div className="md:col-span-2">
            <Field
              label="Extra allowed domains (comma-separated)"
              name="allowedDomains"
              defaultValue={extraDomains.join(", ")}
              placeholder="cdn.example.com, api.example.com"
            />
          </div>
          <Field label="Max pages" name="maxPages" type="number" defaultValue={project?.testingConfig?.maxPages ?? 25} />
          <Field label="Max crawl depth" name="maxDepth" type="number" defaultValue={project?.testingConfig?.maxDepth ?? 3} />
          <Field label="Max duration (seconds)" name="maxDurationSeconds" type="number" defaultValue={project?.testingConfig?.maxDurationSeconds ?? 300} />
          <div>
            <Label>Browser</Label>
            <select name="browser" defaultValue={project?.testingConfig?.browser ?? "chromium"} className="mt-2 h-10 w-full rounded-lg border bg-background px-3 text-sm">
              <option value="chromium">Chromium</option>
              <option value="firefox">Firefox</option>
              <option value="webkit">WebKit</option>
            </select>
          </div>
          <Field label="Test concurrency" name="testConcurrency" type="number" defaultValue={project?.testingConfig?.testConcurrency ?? 1} />
          <label className="md:col-span-2 flex items-start gap-3 rounded-xl border p-4 text-sm">
            <input type="checkbox" name="watchBrowser" defaultChecked={project?.testingConfig?.headless === false} className="mt-1" />
            <span>Watch in browser by default. Chromium opens on this computer so you can see every page and click live.</span>
          </label>
          <label className="md:col-span-2 flex items-start gap-3 rounded-xl border p-4 text-sm">
            <input type="checkbox" name="captureScreenshots" defaultChecked={project?.testingConfig?.captureScreenshots === true} className="mt-1" />
            <span>
              Capture page screenshots during the run. Leave this off to keep Chrome from flashing. Failed tests and confirmed bugs always get a screenshot.
            </span>
          </label>
          <div className="md:col-span-2">
            <Label>Optional business requirements (one per line)</Label>
            <Textarea name="requirements" className="mt-2" defaultValue={project?.requirements?.map((r: any) => r.text).join("\n")} />
          </div>
          <Field label="Optional login username" name="loginUsername" />
          <Field label="Optional login password" name="loginPassword" type="password" />
          <label className="md:col-span-2 flex items-start gap-3 rounded-xl border p-4 text-sm">
            <input type="checkbox" name="acknowledgedAuthorization" required defaultChecked={Boolean(projectId)} className="mt-1" />
            <span>
              I confirm I own this application or am authorized to test it. BugPilot will never crawl domains that are not explicitly allowed.
            </span>
          </label>
          {error ? <p className="md:col-span-2 text-sm text-red-400">{error}</p> : null}
          <div className="md:col-span-2">
            <Button disabled={mutation.isPending}>{projectId ? "Save changes" : "Create project"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <div>
      <Label>{label}</Label>
      <Input className="mt-2" {...rest} />
    </div>
  );
}
