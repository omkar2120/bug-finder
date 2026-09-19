import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api, openAuthedFile } from "@/services/api";
import { EmptyState } from "@/components/EmptyState";
import { Badge, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatMs } from "@/lib/utils";
import { isLiveStatus, statusLabel } from "@/lib/runStatus";
import { ProjectFormPage } from "./ProjectFormPage";

export function ProjectRunsPage() {
  const { projectId } = useParams();
  const { data } = useQuery({
    queryKey: ["project-runs", projectId],
    queryFn: () => api<any[]>(`/projects/${projectId}/test-runs`),
  });
  const runs = data?.data ?? [];
  if (!runs.length) return <EmptyState title="No test runs yet." description="Start your first AI test to analyze this application." />;
  return (
    <div className="overflow-hidden rounded-2xl border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
          <tr><th className="p-3">Started</th><th>Status</th><th>Tests</th><th>Bugs</th><th>Health</th></tr>
        </thead>
        <tbody>
          {runs.map((run: any) => (
            <tr key={run._id} className={`border-t ${isLiveStatus(run.status) ? "bg-primary/5" : ""}`}>
              <td className="p-3">
                <Link to={`/test-runs/${run._id}`} className="font-medium text-primary">
                  {statusLabel(run.status)}
                </Link>
                <div className="text-xs text-muted-foreground">{formatDate(run.createdAt)}</div>
              </td>
              <td><Badge tone={statusTone(run.status)}>{run.status.replaceAll("_", " ")}</Badge></td>
              <td>{run.statistics?.testsExecuted ?? 0}</td>
              <td>{run.statistics?.bugs ?? 0}</td>
              <td>{run.healthScore ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ProjectBugsPage() {
  const { projectId } = useParams();
  const { data } = useQuery({
    queryKey: ["project-bugs", projectId],
    queryFn: () => api<any[]>(`/projects/${projectId}/bugs`),
  });
  const bugs = data?.data ?? [];
  if (!bugs.length) return <EmptyState title="No confirmed bugs found in this project." description="BugPilot investigates failures before creating a bug." />;
  return (
    <div className="overflow-hidden rounded-2xl border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
          <tr><th className="p-3">Key</th><th>Title</th><th>Severity</th><th>Status</th><th>Confidence</th></tr>
        </thead>
        <tbody>
          {bugs.map((bug: any) => (
            <tr key={bug._id} className="border-t">
              <td className="p-3"><Link to={`/bugs/${bug._id}`}>{bug.bugKey}</Link></td>
              <td>{bug.title}</td>
              <td><Badge tone={bug.severity === "critical" ? "danger" : "warning"}>{bug.severity}</Badge></td>
              <td><Badge tone={statusTone(bug.status)}>{bug.status}</Badge></td>
              <td>{Math.round((bug.confidence ?? 0) * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ProjectApisPage() {
  const { projectId } = useParams();
  const { data } = useQuery({
    queryKey: ["project-apis", projectId],
    queryFn: () => api<any[]>(`/projects/${projectId}/apis`),
  });
  const items = data?.data ?? [];
  if (!items.length) return <EmptyState title="No API traffic captured yet." description="Start an AI test to monitor XHR and fetch requests." />;
  return (
    <div className="overflow-hidden rounded-2xl border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
          <tr><th className="p-3">Method</th><th>Endpoint</th><th>Status</th><th>Time</th><th>Result</th></tr>
        </thead>
        <tbody>
          {items.map((item: any) => (
            <tr key={item._id} className="border-t">
              <td className="p-3"><Link to={`/api-requests/${item._id}`}>{item.method}</Link></td>
              <td>{item.endpoint}</td>
              <td>{item.response?.status ?? "—"}</td>
              <td>{formatMs(item.timing?.durationMs)}</td>
              <td><Badge tone={item.result === "success" ? "success" : "danger"}>{item.result}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ProjectContentPage() {
  const { projectId } = useParams();
  const { data } = useQuery({
    queryKey: ["project-content", projectId],
    queryFn: () => api<any[]>(`/projects/${projectId}/content-issues`),
  });
  const items = data?.data ?? [];
  if (!items.length) return <EmptyState title="No content issues detected." description="Visible copy will be inspected during the next AI test." />;
  return (
    <div className="space-y-3">
      {items.map((item: any) => (
        <div key={item._id} className="stat-card">
          <div className="flex justify-between">
            <Badge>{item.type}</Badge>
            <span className="text-xs text-muted-foreground">{Math.round(item.confidence * 100)}%</span>
          </div>
          <div className="mt-2 text-sm">Current: {item.currentText}</div>
          {item.suggestedText ? <div className="text-sm text-primary">Suggested: {item.suggestedText}</div> : null}
          <div className="mt-1 text-xs text-muted-foreground">{item.pageUrl}</div>
        </div>
      ))}
    </div>
  );
}

export function ProjectAccessibilityPage() {
  const { projectId } = useParams();
  const { data } = useQuery({
    queryKey: ["project-a11y", projectId],
    queryFn: () => api<any[]>(`/projects/${projectId}/accessibility-issues`),
  });
  const items = data?.data ?? [];
  if (!items.length) return <EmptyState title="No accessibility issues detected." description="Labels, alt text, landmarks, and keyboard access are checked during analysis." />;
  return (
    <div className="space-y-3">
      {items.map((item: any) => (
        <div key={item._id} className="stat-card">
          <div className="flex justify-between">
            <div className="font-medium">{item.description}</div>
            <Badge tone={item.impact === "critical" ? "danger" : "warning"}>{item.impact}</Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{item.help}</p>
          <p className="mt-1 text-xs">{item.pageUrl}</p>
        </div>
      ))}
    </div>
  );
}

export function ProjectPerformancePage() {
  const { projectId } = useParams();
  const { data } = useQuery({
    queryKey: ["project-perf", projectId],
    queryFn: () => api<any>(`/projects/${projectId}/performance`),
  });
  const metrics = data?.data?.metrics ?? [];
  if (!metrics.length) return <EmptyState title="No performance data yet." description="Page load, TTFB, and API timings are captured during discovery." />;
  return (
    <div className="overflow-hidden rounded-2xl border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
          <tr><th className="p-3">Page</th><th>TTFB</th><th>DCL</th><th>Load</th><th>Warning</th></tr>
        </thead>
        <tbody>
          {metrics.map((item: any) => (
            <tr key={item._id} className="border-t">
              <td className="p-3">{item.pageUrl}</td>
              <td>{formatMs(item.ttfbMs)}</td>
              <td>{formatMs(item.domContentLoadedMs)}</td>
              <td>{formatMs(item.loadMs)}</td>
              <td>{item.warning ? item.warningReason : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ProjectReportsPage() {
  const { projectId } = useParams();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["project-reports", projectId],
    queryFn: () => api<any[]>(`/projects/${projectId}/reports`),
  });
  const create = useMutation({
    mutationFn: () => api(`/projects/${projectId}/reports`, { method: "POST", body: JSON.stringify({ type: "full_qa", format: "html" }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-reports", projectId] }),
  });
  const reports = data?.data ?? [];
  return (
    <div className="space-y-4">
      <Button onClick={() => create.mutate()} disabled={create.isPending}>Generate full QA report</Button>
      {reports.length ? reports.map((report: any) => (
        <button
          key={report._id}
          type="button"
          className="stat-card block w-full text-left"
          onClick={() => openAuthedFile(`/reports/${report._id}/download`)}
        >
          <div className="font-medium">{report.title}</div>
          <div className="text-sm text-muted-foreground">{report.format} · {formatDate(report.createdAt)}</div>
        </button>
      )) : <EmptyState title="No reports yet." description="Generate a full QA report after a completed test run." />}
    </div>
  );
}

export function ProjectSettingsPage() {
  const { projectId } = useParams();
  const archive = useMutation({
    mutationFn: () => api(`/projects/${projectId}`, { method: "DELETE" }),
  });
  return (
    <div className="space-y-6">
      <ProjectFormPage />
      <div className="stat-card">
        <div className="font-medium">Archive project</div>
        <p className="mt-2 text-sm text-muted-foreground">Archived projects remain in MongoDB but cannot start new AI tests.</p>
        <Button className="mt-4" variant="destructive" onClick={() => archive.mutate()}>Archive</Button>
      </div>
    </div>
  );
}
