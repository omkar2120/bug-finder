import type { ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/services/api";
import { EmptyState } from "@/components/EmptyState";
import { Badge, statusTone } from "@/components/ui/badge";
import { MetricCard } from "@/components/MetricCard";
import { ActiveRunCard } from "@/components/ActiveRunCard";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { isLiveStatus, statusLabel } from "@/lib/runStatus";

export function DashboardPage() {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["global-dashboard"],
    queryFn: () => api<any>("/dashboard"),
    refetchInterval: (query) => {
      const runs = query.state.data?.data?.recentRuns ?? [];
      return runs.some((run: any) => isLiveStatus(run.status)) ? 3000 : 15000;
    },
  });
  const dash = data?.data;
  if (!dash) return <p className="text-sm text-muted-foreground">Loading live MongoDB metrics…</p>;

  const activeRuns = (dash.recentRuns ?? []).filter((run: any) => isLiveStatus(run.status));
  const totals = dash.totals;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="page-subtitle">Live workspace</p>
          <h1 className="page-title">QA command center</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Every number below is stored in MongoDB. Start an AI test on an authorized app to watch pages, tests, APIs, and confirmed bugs appear here.
          </p>
        </div>
        <Button onClick={() => navigate("/projects/new")}>New project</Button>
      </div>

      {activeRuns.length ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">AI tests in progress</h2>
            <span className="text-xs text-muted-foreground">{activeRuns.length} live</span>
          </div>
          <div className="space-y-3">
            {activeRuns.map((run: any) => (
              <ActiveRunCard key={run._id} run={run} />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">How healthy is the work?</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Projects" value={totals.totalProjects} hint={`${totals.activeProjects} active and ready to test`} tone="accent" />
          <MetricCard label="Pass rate" value={`${totals.passRate}%`} hint={`${totals.totalTests} tests executed`} tone={totals.passRate >= 80 ? "good" : totals.totalTests ? "warn" : "default"} />
          <MetricCard label="Confirmed bugs" value={totals.totalBugs} hint={`${totals.criticalBugs} critical · ${totals.highBugs} high`} tone={totals.criticalBugs ? "bad" : totals.totalBugs ? "warn" : "good"} />
          <MetricCard label="API failures" value={totals.apiFailures} hint="4xx, 5xx, timeouts, and network errors" tone={totals.apiFailures ? "warn" : "good"} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">What the AI is checking</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard label="Test runs" value={totals.totalTestRuns} hint="Queued, live, and finished" />
          <MetricCard label="Failed tests" value={totals.failedTests} hint="Not every failure becomes a bug" />
          <MetricCard label="Content issues" value={totals.contentIssues} hint="Spelling, placeholders, broken copy" />
          <MetricCard label="Accessibility" value={totals.accessibilityIssues} hint="Labels, alt text, keyboard, ARIA" />
          <MetricCard label="Perf warnings" value={totals.performanceWarnings} hint="Slow pages and APIs" />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Tests started" subtitle="How often AI runs are launched">
          <AreaChart data={dash.charts.testExecutionTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" hide />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Area dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
          </AreaChart>
        </ChartCard>
        <ChartCard title="Passed vs failed" subtitle="Execution results, not confirmed bugs">
          <BarChart data={dash.charts.passFailTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" hide />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="passed" fill="#34d399" />
            <Bar dataKey="failed" fill="#f87171" />
          </BarChart>
        </ChartCard>
        <ChartCard title="Bugs confirmed" subtitle="Only defects that passed AI investigation">
          <AreaChart data={dash.charts.bugTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" hide />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Area dataKey="value" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} />
          </AreaChart>
        </ChartCard>
        <ChartCard title="API response time" subtitle="Average milliseconds from captured traffic">
          <AreaChart data={dash.charts.apiResponseTimeTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" hide />
            <YAxis />
            <Tooltip />
            <Area dataKey="avgMs" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.15} />
          </AreaChart>
        </ChartCard>
      </div>

      <ChartCard title="Bug severity" subtitle="Critical issues should be fixed first">
        <BarChart data={dash.charts.bugSeverityDistribution}>
          <XAxis dataKey="severity" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="hsl(var(--primary))" />
        </BarChart>
      </ChartCard>

      <section className="grid gap-6 lg:grid-cols-2">
        <ListCard title="Projects" emptyTitle="No projects yet" emptyDescription="Create a project and enter an authorized application URL." action="Create project" onAction={() => navigate("/projects/new")}>
          {dash.recentProjects.map((p: any) => (
            <Link key={p._id} to={`/projects/${p._id}`} className="flex items-center justify-between rounded-xl px-2 py-2.5 text-sm hover:bg-muted/50">
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.application?.baseUrl || "Authorized app"}</div>
              </div>
              <Badge tone={statusTone(p.status)}>{p.status}</Badge>
            </Link>
          ))}
        </ListCard>
        <ListCard title="Recent test runs" emptyTitle="No test runs yet" emptyDescription="Start an AI test from a project to see live progress here.">
          {dash.recentRuns.map((r: any) => (
            <Link key={r._id} to={`/test-runs/${r._id}`} className="flex items-center justify-between rounded-xl px-2 py-2.5 text-sm hover:bg-muted/50">
              <div>
                <div className="font-medium">{statusLabel(r.status)}</div>
                <div className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</div>
              </div>
              <Badge tone={statusTone(r.status)}>{r.status.replaceAll("_", " ")}</Badge>
            </Link>
          ))}
        </ListCard>
        <ListCard title="Recent bugs" emptyTitle="No confirmed bugs yet" emptyDescription="BugPilot investigates failures before creating a bug.">
          {dash.recentBugs.map((b: any) => (
            <Link key={b._id} to={`/bugs/${b._id}`} className="flex items-center justify-between rounded-xl px-2 py-2.5 text-sm hover:bg-muted/50">
              <span>{b.bugKey} · {b.title}</span>
              <Badge tone={b.severity === "critical" ? "danger" : "warning"}>{b.severity}</Badge>
            </Link>
          ))}
        </ListCard>
        <ListCard title="Latest AI findings" emptyTitle="No AI findings yet" emptyDescription="Audit entries appear after the first analyzed run.">
          {dash.latestAiFindings.map((a: any) => (
            <div key={a._id} className="rounded-xl px-2 py-2.5 text-sm">
              <div className="font-medium">{a.type.replaceAll("_", " ")}</div>
              <div className="text-xs text-muted-foreground">{a.model} · {a.provider}</div>
            </div>
          ))}
        </ListCard>
      </section>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactElement }) {
  return (
    <div className="stat-card">
      <div className="mb-4">
        <div className="text-sm font-semibold">{title}</div>
        {subtitle ? <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div> : null}
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ListCard({
  title,
  emptyTitle,
  emptyDescription,
  children,
  action,
  onAction,
}: {
  title: string;
  emptyTitle: string;
  emptyDescription: string;
  children: React.ReactNode;
  action?: string;
  onAction?: () => void;
}) {
  const items = Array.isArray(children) ? children : [children];
  const hasItems = items.filter(Boolean).length > 0;
  return (
    <div className="stat-card">
      <div className="mb-3 text-sm font-semibold">{title}</div>
      {hasItems ? <div className="divide-y divide-border/70">{children}</div> : (
        <EmptyState title={emptyTitle} description={emptyDescription} actionLabel={action} onAction={onAction} />
      )}
    </div>
  );
}
