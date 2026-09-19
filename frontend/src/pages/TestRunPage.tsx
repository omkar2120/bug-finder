import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getAccessToken } from "@/services/api";
import { Badge, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AuthedImage } from "@/components/AuthedImage";
import { MetricCard } from "@/components/MetricCard";
import { QueuedHero, RunPipeline } from "@/components/RunPipeline";
import { TestRunFindings } from "@/components/TestRunFindings";
import { formatWait, isLiveStatus, statusExplanation, statusLabel } from "@/lib/runStatus";

export function TestRunPage() {
  const { testRunId } = useParams();
  const qc = useQueryClient();
  const [events, setEvents] = useState<any[]>([]);
  const [now, setNow] = useState(Date.now());
  const run = useQuery({
    queryKey: ["test-run", testRunId],
    queryFn: () => api<any>(`/test-runs/${testRunId}`),
    refetchInterval: (query) => (isLiveStatus(query.state.data?.data?.status) ? 2000 : false),
  });
  const cases = useQuery({
    queryKey: ["test-cases", testRunId],
    queryFn: () => api<any[]>(`/test-runs/${testRunId}/test-cases`),
    refetchInterval: 3000,
  });
  const results = useQuery({
    queryKey: ["test-results", testRunId],
    queryFn: () => api<any[]>(`/test-runs/${testRunId}/test-results`),
    refetchInterval: 3000,
  });
  const shots = useQuery({
    queryKey: ["run-shots", testRunId],
    queryFn: () => api<any[]>(`/test-runs/${testRunId}/screenshots`),
    refetchInterval: () => {
      const status = run.data?.data?.status;
      if (!isLiveStatus(status)) return false;
      return run.data?.data?.configuration?.captureScreenshots ? 4000 : 10000;
    },
  });
  const cancel = useMutation({
    mutationFn: () => api(`/test-runs/${testRunId}/cancel`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["test-run", testRunId] }),
  });
  const retry = useMutation({
    mutationFn: () => api(`/test-runs/${testRunId}/retry`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["test-run", testRunId] });
      qc.invalidateQueries({ queryKey: ["test-cases", testRunId] });
    },
  });

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const token = getAccessToken();
    let cancelled = false;
    async function connect() {
      const res = await fetch(`/api/v1/test-runs/${testRunId}/events`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const reader = res.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let buffer = "";
      while (!cancelled) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const dataLine = chunk.split("\n").find((line) => line.startsWith("data: "));
          if (!dataLine) continue;
          try {
            const payload = JSON.parse(dataLine.slice(6));
            if (payload.message) setEvents((prev) => [...prev, payload]);
          } catch {
            // ignore keepalives
          }
        }
      }
    }
    connect();
    return () => {
      cancelled = true;
    };
  }, [testRunId]);

  const data = run.data?.data;
  if (!data) return <p className="text-sm text-muted-foreground">Loading live test run…</p>;
  const stats = data.statistics ?? {};
  const timeline = events.length ? events : data.timeline ?? [];
  const waited = formatWait(Math.max(0, Math.round((now - new Date(data.startedAt || data.createdAt).getTime()) / 1000)));
  const queued = data.status === "queued";
  const latestShot = (shots.data?.data ?? []).at(-1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="page-subtitle">{isLiveStatus(data.status) ? "Live AI test" : "Test run"}</p>
          <h1 className="page-title">{statusLabel(data.status)}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{statusExplanation(data.status)}</p>
          {data.configuration?.baseUrl ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Testing {String(data.configuration.environment || "").toUpperCase()}:{" "}
              <span className="break-all text-foreground">{data.configuration.baseUrl}</span>
            </p>
          ) : null}
          {data.brief?.instructions || data.brief?.customCases?.length || data.brief?.focusPages?.length ? (
            <div className="mt-3 max-w-2xl rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
              <div className="font-medium">Your brief</div>
              <div className="mt-1 text-muted-foreground">
                {data.brief.focusMode !== "full" ? `${data.brief.focusMode} · ` : ""}
                {(data.brief.focusPages ?? []).join(", ") || "pages from the authorized app"}
              </div>
              {data.brief.instructions ? <p className="mt-1">{data.brief.instructions}</p> : null}
              {(data.brief.customCases ?? []).length ? (
                <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                  {data.brief.customCases.map((item: string) => <li key={item}>{item}</li>)}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <Badge tone={statusTone(data.status)}>{data.status.replaceAll("_", " ")}</Badge>
          {data.configuration?.environment ? (
            <Badge>{String(data.configuration.environment).toUpperCase()}</Badge>
          ) : null}
          {data.configuration?.headless === false && isLiveStatus(data.status) ? (
            <Badge tone="accent">Watching browser</Badge>
          ) : null}
          {queued || data.status === "failed" ? (
            <Button onClick={() => retry.mutate()} disabled={retry.isPending}>
              {retry.isPending ? "Starting…" : queued ? "Start now" : "Retry run"}
            </Button>
          ) : null}
          {isLiveStatus(data.status) ? (
            <Button variant="outline" onClick={() => cancel.mutate()}>Cancel</Button>
          ) : null}
        </div>
      </div>

      {queued ? (
        <QueuedHero
          status={data.status}
          activity={data.currentActivity}
          waited={waited}
          action={
            <Button onClick={() => retry.mutate()} disabled={retry.isPending}>
              {retry.isPending ? "Starting…" : "Start this test now"}
            </Button>
          }
        />
      ) : (
        <div className="stat-card space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-primary">
                {isLiveStatus(data.status) ? "Live — what Playwright is doing" : "Last activity"}
              </div>
              <div className="mt-2 text-2xl font-semibold">{data.currentTestName || data.currentActivity || statusLabel(data.status)}</div>
              {data.currentStep ? (
                <div className="mt-2 rounded-xl bg-primary/10 px-3 py-2 text-sm font-medium">{data.currentStep}</div>
              ) : null}
              <div className="mt-2 text-sm text-muted-foreground">
                {data.currentActivity}
              </div>
              <div className="mt-1 text-sm">
                Page: <span className="break-all text-foreground">{data.currentPage || "Waiting for the first authorized page"}</span>
              </div>
              {data.configuration?.headless === false && isLiveStatus(data.status) ? (
                <p className="mt-3 text-sm text-primary">
                  Chrome is open for this run. A black label in the top-left names the current step. It closes when the session finishes.
                </p>
              ) : data.configuration?.headless === false ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  This run was watched in Chrome. The window should now be closed.
                </p>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  This run is hidden (headless). Use <span className="font-medium text-foreground">Watch live in Chrome</span> on the next run.
                </p>
              )}
            </div>
            {isLiveStatus(data.status) ? <span className="text-xs text-muted-foreground">Running {waited}</span> : null}
          </div>
          <RunPipeline status={data.status} />
          {latestShot && data.configuration?.captureScreenshots ? (
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Latest screenshot</div>
              <AuthedImage screenshotId={latestShot._id} alt={latestShot.metadata?.pageUrl || "Latest page"} className="max-h-80 w-full rounded-xl border object-cover object-top" />
            </div>
          ) : null}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4 xl:grid-cols-8">
        <MetricCard label="Pages" value={stats.pagesDiscovered ?? 0} hint="Discovered" />
        <MetricCard label="Generated" value={stats.testsGenerated ?? 0} hint="AI tests" />
        <MetricCard label="Executed" value={stats.testsExecuted ?? 0} hint="Playwright" />
        <MetricCard label="Passed" value={stats.passed ?? 0} hint="Happy path" tone="good" />
        <MetricCard label="Failed" value={stats.failed ?? 0} hint="Needs review" tone={stats.failed ? "warn" : "default"} />
        <MetricCard label="Bugs" value={stats.bugs ?? 0} hint="Confirmed" tone={stats.bugs ? "bad" : "default"} />
        <MetricCard label="APIs" value={stats.apiRequests ?? 0} hint="Captured" />
        <MetricCard label="Content" value={stats.contentIssues ?? 0} hint="Copy issues" />
      </div>

      <div className="stat-card">
        <div>
          <div className="mb-3 font-semibold">Live timeline</div>
          <div className="max-h-[420px] space-y-2 overflow-auto text-sm">
            {timeline.length ? timeline.map((event: any, index: number) => (
              <div key={`${event._id || event.createdAt}-${index}`} className="rounded-xl bg-muted/40 px-3 py-2">
                <span className="mr-2">{iconFor(event.type)}</span>
                {event.message}
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed p-6">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span className="h-2 w-2 animate-ping rounded-full bg-primary" />
                  Waiting in the queue
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  The run is saved in MongoDB. As soon as the AI engineer starts, you will see: application opened, pages discovered, tests generated, then pass/fail and confirmed bugs.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <TestRunFindings
        testRunId={testRunId!}
        projectId={String(data.projectId)}
        status={data.status}
        cases={cases.data?.data ?? []}
        results={results.data?.data ?? []}
        currentTestName={data.currentTestName}
      />

      <div className="flex gap-4 text-sm">
        <Link to={`/projects/${data.projectId}`} className="text-primary">Back to project</Link>
        <Link to={`/projects/${data.projectId}/reports`} className="text-primary">Project reports</Link>
        {data.healthScore != null ? <span>QA Health Score: {data.healthScore}/100</span> : null}
      </div>
    </div>
  );
}

function iconFor(type?: string) {
  if (type?.includes("BUG")) return "🐛";
  if (type?.includes("FAILED") || type?.includes("WARNING") || type?.includes("ISSUE")) return "⚠";
  if (type?.includes("AI")) return "🔍";
  return "✓";
}
