import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api } from "@/services/api";
import { Badge, statusTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { MetricCard } from "@/components/MetricCard";
import { ActiveRunCard } from "@/components/ActiveRunCard";
import { formatDate } from "@/lib/utils";
import { isLiveStatus, statusLabel } from "@/lib/runStatus";

export function ProjectOverviewPage() {
  const { projectId } = useParams();
  const { data } = useQuery({
    queryKey: ["project-dashboard", projectId],
    queryFn: () => api<any>(`/projects/${projectId}/dashboard`),
    refetchInterval: (query) => {
      const runs = query.state.data?.data?.recentRuns ?? [];
      return runs.some((run: any) => isLiveStatus(run.status)) ? 3000 : 12000;
    },
  });
  const dash = data?.data;
  if (!dash) return <p className="text-sm text-muted-foreground">Loading project metrics…</p>;

  const activeRuns = (dash.recentRuns ?? []).filter((run: any) => isLiveStatus(run.status));
  const health = dash.healthScore.score;
  const healthTone = health >= 85 ? "good" : health >= 65 ? "warn" : "bad";

  return (
    <div className="space-y-6">
      {activeRuns.length ? (
        <div className="space-y-3">
          {activeRuns.map((run: any) => (
            <ActiveRunCard key={run._id} run={run} />
          ))}
        </div>
      ) : null}

      <div className="stat-card bg-gradient-to-br from-primary/10 to-transparent">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">BugPilot QA Health Score</div>
        <div className={`mt-2 text-5xl font-semibold ${healthTone === "good" ? "text-emerald-400" : healthTone === "warn" ? "text-amber-400" : "text-red-400"}`}>
          {health}<span className="text-2xl text-muted-foreground">/100</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{dash.healthScore.disclaimer}</p>
        {dash.healthScore.reasons.length ? (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {dash.healthScore.reasons.map((reason: string) => (
              <li key={reason} className="rounded-xl bg-background/40 px-3 py-2 text-sm">{reason}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">No penalties yet. Start a test to see what changes the score.</p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Runs" value={dash.tests.runs} hint="All AI test runs for this app" />
        <MetricCard label="Pass rate" value={`${dash.tests.passRate}%`} hint={`${dash.tests.executed} tests executed`} tone={dash.tests.passRate >= 80 ? "good" : dash.tests.executed ? "warn" : "default"} />
        <MetricCard label="Open bugs" value={dash.bugs.open} hint="Confirmed issues still needing action" tone={dash.bugs.open ? "warn" : "good"} />
        <MetricCard label="API failures" value={dash.apis.clientErrors + dash.apis.serverErrors} hint="Unexpected 4xx and 5xx responses" tone={dash.apis.clientErrors + dash.apis.serverErrors ? "warn" : "good"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="stat-card">
          <div className="mb-3 font-semibold">Recent runs</div>
          {dash.recentRuns.length ? dash.recentRuns.map((run: any) => (
            <Link key={run._id} to={`/test-runs/${run._id}`} className="flex items-center justify-between rounded-xl py-2.5 text-sm hover:bg-muted/40">
              <div>
                <div className="font-medium">{statusLabel(run.status)}</div>
                <div className="text-xs text-muted-foreground">{formatDate(run.createdAt)}</div>
              </div>
              <Badge tone={statusTone(run.status)}>{run.status.replaceAll("_", " ")}</Badge>
            </Link>
          )) : <EmptyState title="No test runs yet." description="Start your first AI test to analyze this application." />}
        </div>
        <div className="stat-card">
          <div className="mb-3 font-semibold">Recent bugs</div>
          {dash.recentBugs.length ? dash.recentBugs.map((bug: any) => (
            <Link key={bug._id} to={`/bugs/${bug._id}`} className="flex justify-between rounded-xl py-2.5 text-sm hover:bg-muted/40">
              <span>{bug.bugKey} · {bug.title}</span>
              <Badge tone="warning">{bug.severity}</Badge>
            </Link>
          )) : <EmptyState title="No confirmed bugs found in this project." description="Failures are investigated before a bug is created." />}
        </div>
      </div>
    </div>
  );
}
