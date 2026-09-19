import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Badge, statusTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { formatDate } from "@/lib/utils";

export function ProjectsPage() {
  const navigate = useNavigate();
  const { data } = useQuery({ queryKey: ["projects"], queryFn: () => api<any[]>("/projects") });
  const projects = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">Each project is scoped to explicitly authorized domains.</p>
        </div>
        <Button onClick={() => navigate("/projects/new")}>New project</Button>
      </div>
      {projects.length === 0 ? (
        <EmptyState
          title="No projects yet."
          description="Create a project, enter an authorized application URL, and start your first AI test."
          actionLabel="Create project"
          onAction={() => navigate("/projects/new")}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((project: any) => (
            <Link key={project.id} to={`/projects/${project.id}`} className="stat-card block hover:border-primary/40">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">{project.name}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{project.application.baseUrl}</div>
                </div>
                <Badge tone={statusTone(project.status)}>{project.status}</Badge>
              </div>
              <div className="mt-4 text-xs text-muted-foreground">
                {String(project.application.environment || "qa").toUpperCase()} · updated {formatDate(project.updatedAt)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
