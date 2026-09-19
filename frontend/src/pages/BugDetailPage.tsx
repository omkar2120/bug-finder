import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getAccessToken } from "@/services/api";
import { Badge, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMs } from "@/lib/utils";

export function BugDetailPage() {
  const { bugId } = useParams();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["bug", bugId], queryFn: () => api<any>(`/bugs/${bugId}`) });
  const update = useMutation({
    mutationFn: (body: object) => api(`/bugs/${bugId}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bug", bugId] }),
  });
  const bug = data?.data;
  if (!bug) return <p>Loading bug evidence…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="page-subtitle">{bug.bugKey}</p>
          <h1 className="page-title">{bug.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{bug.page?.url}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={bug.severity === "critical" ? "danger" : "warning"}>{bug.severity}</Badge>
          <Badge>{bug.priority}</Badge>
          <Badge tone={statusTone(bug.status)}>{bug.status}</Badge>
          <Badge tone="accent">{Math.round((bug.confidence ?? 0) * 100)}% confidence</Badge>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => update.mutate({ status: "confirmed" })}>Confirm</Button>
        <Button size="sm" variant="outline" onClick={() => update.mutate({ status: "duplicate" })}>Mark Duplicate</Button>
        <Button size="sm" variant="outline" onClick={() => update.mutate({ status: "false_positive" })}>Mark False Positive</Button>
        <Button size="sm" variant="outline" onClick={() => update.mutate({ status: "resolved" })}>Resolve</Button>
        <Button size="sm" variant="ghost" onClick={() => update.mutate({ status: "reopened" })}>Reopen</Button>
        <Button size="sm" variant="ghost" disabled>Create Jira issue</Button>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="stat-card space-y-3">
          <h2 className="font-medium">Expected vs actual</h2>
          <p className="text-sm"><span className="text-muted-foreground">Expected:</span> {bug.reproduction?.expected}</p>
          <p className="text-sm"><span className="text-muted-foreground">Actual:</span> {bug.reproduction?.actual}</p>
          <h3 className="pt-2 text-sm font-medium">Steps to reproduce</h3>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {(bug.reproduction?.steps ?? []).map((step: string) => <li key={step}>{step}</li>)}
          </ol>
        </section>
        <section className="stat-card space-y-3">
          <h2 className="font-medium">AI analysis</h2>
          <p className="text-sm">{bug.aiAnalysis?.summary || bug.rootCause || "No additional analysis stored."}</p>
          <p className="text-xs text-muted-foreground">{bug.category} · {bug.aiAnalysis?.model}</p>
        </section>
      </div>
      <section className="stat-card">
        <h2 className="mb-3 font-medium">Screenshots</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {(bug.screenshots ?? []).map((shot: any) => (
            <img
              key={shot._id}
              alt="Bug evidence"
              className="rounded-xl border"
              src={`/api/v1/screenshots/${shot._id}`}
              onLoad={(event) => {
                const img = event.currentTarget;
                if (!img.dataset.authed) {
                  fetch(`/api/v1/screenshots/${shot._id}`, {
                    headers: { Authorization: `Bearer ${getAccessToken()}` },
                  })
                    .then((res) => res.blob())
                    .then((blob) => {
                      img.src = URL.createObjectURL(blob);
                      img.dataset.authed = "1";
                    });
                }
              }}
            />
          ))}
        </div>
      </section>
      <section className="stat-card">
        <h2 className="mb-3 font-medium">Related API requests</h2>
        {(bug.relatedApiDetails ?? []).map((apiItem: any) => (
          <Link key={apiItem._id} to={`/api-requests/${apiItem._id}`} className="flex justify-between border-b py-2 text-sm last:border-0">
            <span>{apiItem.method} {apiItem.endpoint}</span>
            <span>{apiItem.response?.status} · {formatMs(apiItem.timing?.durationMs)}</span>
          </Link>
        ))}
      </section>
      <section className="stat-card">
        <h2 className="mb-3 font-medium">Console errors</h2>
        {(bug.consoleLogs ?? []).map((log: any) => (
          <pre key={log._id} className="overflow-auto rounded-lg bg-muted/40 p-3 text-xs">{log.message}</pre>
        ))}
      </section>
      <section className="stat-card">
        <h2 className="mb-3 font-medium">Related bugs</h2>
        {(bug.relatedBugs ?? []).map((related: any) => (
          <Link key={related._id} to={`/bugs/${related._id}`} className="block py-1 text-sm">
            {related.bugKey} · {related.title}
          </Link>
        ))}
      </section>
    </div>
  );
}
