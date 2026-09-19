import { useState } from "react";
import { NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StartTestDialog, type StartTestPayload } from "@/components/StartTestDialog";
import { ENV_LABELS, envUrl, normalizeEnv } from "@/lib/environments";

const tabs = [
  { to: "", label: "Overview", end: true },
  { to: "runs", label: "Test Runs" },
  { to: "bugs", label: "Bugs" },
  { to: "apis", label: "APIs" },
  { to: "content", label: "Content" },
  { to: "accessibility", label: "Accessibility" },
  { to: "performance", label: "Performance" },
  { to: "reports", label: "Reports" },
  { to: "settings", label: "Settings" },
];

export function ProjectLayout() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const project = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => api<any>(`/projects/${projectId}`),
  });
  const [briefOpen, setBriefOpen] = useState(false);
  const [watchDefault, setWatchDefault] = useState(true);
  const start = useMutation({
    mutationFn: (payload: StartTestPayload) =>
      api<{ testRunId: string; status: string }>(`/projects/${projectId}/test-runs`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (res) => {
      setBriefOpen(false);
      qc.invalidateQueries({ queryKey: ["project-dashboard", projectId] });
      navigate(`/test-runs/${res.data.testRunId}`);
    },
  });

  const data = project.data?.data;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="page-subtitle">Authorized application</p>
          <h1 className="page-title">{data?.name ?? "Project"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data?.application
              ? `${ENV_LABELS[normalizeEnv(data.application.environment)]} · ${envUrl(data.application)}`
              : "Add PROD, QA, and UAT URLs in settings"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={start.isPending || data?.status === "archived"}
            onClick={() => {
              setWatchDefault(true);
              setBriefOpen(true);
            }}
          >
            Watch live in Chrome
          </Button>
          <Button
            variant="outline"
            disabled={start.isPending || data?.status === "archived"}
            onClick={() => {
              setWatchDefault(false);
              setBriefOpen(true);
            }}
          >
            Start in background
          </Button>
        </div>
      </div>
      {start.error ? <p className="text-sm text-red-400">{(start.error as Error).message}</p> : null}
      <div className="flex flex-wrap gap-2 border-b pb-3">
        {tabs.map((tab) => (
          <NavLink
            key={tab.label}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `rounded-full px-3 py-1 text-sm ${isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`
            }
          >
            {tab.label}
          </NavLink>
        ))}
        {data?.status === "archived" ? <Badge tone="warning">Archived</Badge> : null}
      </div>
      <Outlet />
      {briefOpen ? (
        <StartTestDialog
          application={data?.application}
          starting={start.isPending}
          defaultWatch={watchDefault}
          defaultCaptureScreenshots={data?.testingConfig?.captureScreenshots === true}
          onClose={() => setBriefOpen(false)}
          onStart={(payload) => start.mutate(payload)}
        />
      ) : null}
    </div>
  );
}
