import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, openAuthedFile } from "@/services/api";
import { AuthedImage } from "@/components/AuthedImage";
import { Badge, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { formatMs } from "@/lib/utils";
import { isLiveStatus } from "@/lib/runStatus";

const TABS = [
  { id: "tests", label: "What was tested" },
  { id: "screenshots", label: "Screenshots" },
  { id: "apis", label: "APIs & timing" },
  { id: "content", label: "Grammar & copy" },
  { id: "bugs", label: "Bugs" },
  { id: "performance", label: "Slow pages" },
  { id: "report", label: "Report" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function TestRunFindings({
  testRunId,
  projectId,
  status,
  cases,
  results,
  currentTestName,
}: {
  testRunId: string;
  projectId: string;
  status?: string;
  cases: any[];
  results: any[];
  currentTestName?: string;
}) {
  const [tab, setTab] = useState<TabId>("tests");
  const [openTest, setOpenTest] = useState<string | null>(null);
  const live = isLiveStatus(status);
  const interval = live ? 3000 : false;

  const shots = useQuery({
    queryKey: ["run-shots", testRunId],
    queryFn: () => api<any[]>(`/test-runs/${testRunId}/screenshots`),
    refetchInterval: interval,
  });
  const apis = useQuery({
    queryKey: ["run-apis", testRunId],
    queryFn: () => api<any[]>(`/test-runs/${testRunId}/api-requests?limit=100`),
    refetchInterval: interval,
  });
  const content = useQuery({
    queryKey: ["run-content", testRunId],
    queryFn: () => api<any[]>(`/test-runs/${testRunId}/content-issues`),
    refetchInterval: interval,
  });
  const bugs = useQuery({
    queryKey: ["run-bugs", testRunId],
    queryFn: () => api<any[]>(`/test-runs/${testRunId}/bugs`),
    refetchInterval: interval,
  });
  const perf = useQuery({
    queryKey: ["run-perf", testRunId],
    queryFn: () => api<any>(`/test-runs/${testRunId}/performance`),
    refetchInterval: interval,
  });
  const a11y = useQuery({
    queryKey: ["run-a11y", testRunId],
    queryFn: () => api<any[]>(`/test-runs/${testRunId}/accessibility-issues`),
    refetchInterval: interval,
  });

  const shotItems = shots.data?.data ?? [];
  const apiItems = apis.data?.data ?? [];
  const contentItems = content.data?.data ?? [];
  const bugItems = bugs.data?.data ?? [];
  const a11yItems = a11y.data?.data ?? [];
  const perfData = perf.data?.data;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Findings for this run</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Screenshots, exact test steps, API errors, slow APIs, grammar, bugs, and the downloadable report all live here — not only on project tabs.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-full px-3 py-1 text-sm ${tab === item.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          >
            {item.label}
            {item.id === "screenshots" && shotItems.length ? ` (${shotItems.length})` : ""}
            {item.id === "apis" && apiItems.length ? ` (${apiItems.length})` : ""}
            {item.id === "content" && contentItems.length ? ` (${contentItems.length})` : ""}
            {item.id === "bugs" && bugItems.length ? ` (${bugItems.length})` : ""}
          </button>
        ))}
      </div>

      {tab === "tests" ? (
        <TestsPanel cases={cases} results={results} openTest={openTest} setOpenTest={setOpenTest} currentTestName={currentTestName} />
      ) : null}

      {tab === "screenshots" ? (
        shotItems.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shotItems.map((shot: any) => (
              <figure key={shot._id} className="stat-card overflow-hidden p-3">
                <AuthedImage screenshotId={shot._id} alt={shot.metadata?.pageUrl || "Screenshot"} className="w-full rounded-lg border" />
                <figcaption className="mt-2 truncate text-xs text-muted-foreground">{shot.metadata?.pageUrl || "Captured during the run"}</figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <EmptyState title="No screenshots yet." description="Page and test screenshots appear here as soon as Playwright captures them." />
        )
      ) : null}

      {tab === "apis" ? <ApisPanel items={apiItems} /> : null}

      {tab === "content" ? (
        <div className="space-y-3">
          {contentItems.length ? contentItems.map((item: any) => (
            <div key={item._id} className="stat-card">
              <div className="flex justify-between gap-3">
                <Badge>{item.type}</Badge>
                <span className="text-xs text-muted-foreground">{Math.round((item.confidence ?? 0) * 100)}% · {item.severity}</span>
              </div>
              <div className="mt-2 text-sm">Found: {item.currentText}</div>
              {item.suggestedText ? <div className="text-sm text-primary">Suggested: {item.suggestedText}</div> : null}
              {item.aiAnalysis?.explanation || item.explanation ? (
                <p className="mt-1 text-sm text-muted-foreground">{item.aiAnalysis?.explanation || item.explanation}</p>
              ) : null}
              <div className="mt-1 text-xs text-muted-foreground">{item.pageUrl}</div>
            </div>
          )) : <EmptyState title="No grammar or copy issues stored for this run." description="Spelling, grammar, placeholders, and broken text are inspected after discovery." />}
          {a11yItems.length ? (
            <div className="pt-2">
              <h3 className="mb-2 text-sm font-semibold">Accessibility on the same pages</h3>
              <div className="space-y-2">
                {a11yItems.slice(0, 8).map((item: any) => (
                  <div key={item._id} className="rounded-xl border px-3 py-2 text-sm">
                    <div className="flex justify-between gap-2">
                      <span>{item.description}</span>
                      <Badge tone={item.impact === "critical" ? "danger" : "warning"}>{item.impact}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "bugs" ? (
        bugItems.length ? (
          <div className="overflow-hidden rounded-2xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr><th className="p-3">Bug</th><th>Severity</th><th>Status</th></tr>
              </thead>
              <tbody>
                {bugItems.map((bug: any) => (
                  <tr key={bug._id} className="border-t">
                    <td className="p-3">
                      <Link to={`/bugs/${bug._id}`} className="font-medium text-primary">{bug.bugKey}</Link>
                      <div className="text-muted-foreground">{bug.title}</div>
                    </td>
                    <td><Badge tone={bug.severity === "critical" ? "danger" : "warning"}>{bug.severity}</Badge></td>
                    <td><Badge tone={statusTone(bug.status)}>{bug.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No confirmed bugs on this run." description="Failed tests are investigated first. Only confirmed application defects become bugs." />
        )
      ) : null}

      {tab === "performance" ? <PerfPanel data={perfData} /> : null}

      {tab === "report" ? (
        <ReportPanel projectId={projectId} testRunId={testRunId} status={status} />
      ) : null}
    </section>
  );
}

function TestsPanel({
  cases,
  results,
  openTest,
  setOpenTest,
  currentTestName,
}: {
  cases: any[];
  results: any[];
  openTest: string | null;
  setOpenTest: (id: string | null) => void;
  currentTestName?: string;
}) {
  if (!cases.length) {
    return <EmptyState title="Tests are not generated yet." description="After discovery, each generated test appears here with the exact steps Playwright will run." />;
  }
  return (
    <div className="space-y-2">
      {cases.map((test: any) => {
        const result = results.find((item: any) => String(item.testCaseId) === String(test._id));
        const open = openTest === test._id;
        const live = Boolean(currentTestName && currentTestName === test.name);
        return (
          <div key={test._id} className={`rounded-2xl border ${live ? "border-primary bg-primary/5" : ""}`}>
            <button
              type="button"
              className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
              onClick={() => setOpenTest(open ? null : test._id)}
            >
              <div>
                <div className="font-medium">{test.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {test.type} · {test.priority} · {(test.steps ?? []).length} steps
                  {result?.pageUrl ? ` · ${result.pageUrl}` : ""}
                </div>
              </div>
              <Badge tone={statusTone(live ? "running" : result?.status ?? "queued")}>{live ? "now" : result?.status ?? "waiting"}</Badge>
            </button>
            {open ? (
              <div className="space-y-3 border-t px-4 py-3 text-sm">
                {test.description ? <p className="text-muted-foreground">{test.description}</p> : null}
                <ol className="list-decimal space-y-1 pl-5">
                  {(test.steps ?? []).map((step: any, index: number) => (
                    <li key={`${test._id}-${index}`}>
                      <span className="font-medium">{step.action}</span>
                      {step.target ? <span> on <code>{step.target}</code></span> : null}
                      {step.value ? <span> → {String(step.value).slice(0, 80)}</span> : null}
                    </li>
                  ))}
                </ol>
                <p><span className="text-muted-foreground">Expected:</span> {test.expectedResult || "—"}</p>
                {result?.actualResult ? <p><span className="text-muted-foreground">Actual:</span> {result.actualResult}</p> : null}
                {result?.error?.message ? <p className="text-destructive">{result.error.message}</p> : null}
                {result?.durationMs != null ? <p className="text-xs text-muted-foreground">Ran in {formatMs(result.durationMs)}</p> : null}
                {(result?.evidence?.screenshotIds ?? []).map((id: string) => (
                  <AuthedImage key={id} screenshotId={id} alt={test.name} className="mt-2 max-w-md rounded-lg border" />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function ApisPanel({ items }: { items: any[] }) {
  if (!items.length) {
    return <EmptyState title="No API calls captured yet." description="XHR and fetch traffic from the authorized app appears here with status and duration." />;
  }
  const failed = items.filter((item) => item.result && item.result !== "success");
  const slow = [...items].sort((a, b) => (b.timing?.durationMs ?? 0) - (a.timing?.durationMs ?? 0)).slice(0, 5);
  return (
    <div className="space-y-4">
      {failed.length ? (
        <div className="stat-card">
          <h3 className="mb-2 font-semibold">API errors</h3>
          {failed.map((item) => (
            <Link key={item._id} to={`/api-requests/${item._id}`} className="flex justify-between gap-3 border-b py-2 text-sm last:border-0">
              <span>{item.method} {item.endpoint}</span>
              <span>{item.response?.status ?? item.result} · {formatMs(item.timing?.durationMs)}</span>
            </Link>
          ))}
        </div>
      ) : null}
      <div className="stat-card">
        <h3 className="mb-2 font-semibold">Slowest APIs</h3>
        {slow.map((item) => (
          <Link key={`slow-${item._id}`} to={`/api-requests/${item._id}`} className="flex justify-between gap-3 border-b py-2 text-sm last:border-0">
            <span>{item.method} {item.endpoint}</span>
            <span className={(item.timing?.durationMs ?? 0) >= 1000 ? "text-amber-400" : ""}>{formatMs(item.timing?.durationMs)}</span>
          </Link>
        ))}
      </div>
      <div className="overflow-hidden rounded-2xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="p-3">Method</th><th>Endpoint</th><th>Status</th><th>Time</th><th>Result</th></tr>
          </thead>
          <tbody>
            {items.map((item: any) => (
              <tr key={`all-${item._id}`} className="border-t">
                <td className="p-3"><Link to={`/api-requests/${item._id}`} className="text-primary">{item.method}</Link></td>
                <td className="max-w-[280px] truncate">{item.endpoint}</td>
                <td>{item.response?.status ?? "—"}</td>
                <td>{formatMs(item.timing?.durationMs)}</td>
                <td><Badge tone={item.result === "success" ? "success" : "danger"}>{item.result}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PerfPanel({ data }: { data?: any }) {
  if (!data || !(data.pages ?? []).length) {
    return <EmptyState title="No page timings yet." description="TTFB, load time, and the slowest APIs are stored after discovery." />;
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="stat-card">
        <h3 className="mb-2 font-semibold">Slowest pages</h3>
        {(data.slowestPages ?? []).map((page: any) => (
          <div key={page._id} className="flex justify-between gap-3 border-b py-2 text-sm last:border-0">
            <span className="truncate">{page.pageUrl}</span>
            <span>{formatMs(page.loadMs)}</span>
          </div>
        ))}
        <p className="mt-3 text-xs text-muted-foreground">Average load {formatMs(data.avgLoadMs)} · average API {formatMs(data.avgApiMs)}</p>
      </div>
      <div className="stat-card">
        <h3 className="mb-2 font-semibold">Slowest APIs</h3>
        {(data.slowestApis ?? []).map((item: any) => (
          <Link key={item._id} to={`/api-requests/${item._id}`} className="flex justify-between gap-3 border-b py-2 text-sm last:border-0">
            <span>{item.method} {item.endpoint}</span>
            <span>{formatMs(item.timing?.durationMs)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function ReportPanel({ projectId, testRunId, status }: { projectId: string; testRunId: string; status?: string }) {
  const qc = useQueryClient();
  const reports = useQuery({
    queryKey: ["project-reports", projectId],
    queryFn: () => api<any[]>(`/projects/${projectId}/reports`),
  });
  const create = useMutation({
    mutationFn: (format: "html" | "json") =>
      api(`/projects/${projectId}/reports`, {
        method: "POST",
        body: JSON.stringify({ type: "full_qa", format, testRunId }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-reports", projectId] }),
  });
  const mine = (reports.data?.data ?? []).filter((report: any) => String(report.testRunId) === String(testRunId));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        The report includes tests, bugs, API errors, timings, grammar/content issues, accessibility, and screenshots referenced in this run.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button disabled={create.isPending || status === "queued"} onClick={() => create.mutate("html")}>
          {create.isPending ? "Generating…" : "Generate HTML report"}
        </Button>
        <Button variant="outline" disabled={create.isPending} onClick={() => create.mutate("json")}>
          Generate JSON
        </Button>
        <Link to={`/projects/${projectId}/reports`} className="self-center text-sm text-primary">All project reports</Link>
      </div>
      {mine.length ? mine.map((report: any) => (
        <button
          key={report._id}
          type="button"
          className="stat-card block w-full text-left"
          onClick={() => openAuthedFile(`/reports/${report._id}/download`)}
        >
          <div className="font-medium">{report.title}</div>
          <div className="text-sm text-muted-foreground">{report.format} · open in a new tab</div>
        </button>
      )) : <EmptyState title="No report generated for this run yet." description="Create an HTML report after the run finishes, or while findings are already stored." />}
    </div>
  );
}
