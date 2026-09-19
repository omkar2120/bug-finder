import { Link } from "react-router-dom";
import { formatWait, isLiveStatus, statusExplanation, statusLabel, waitSeconds } from "@/lib/runStatus";
import { RunPipeline } from "./RunPipeline";
import { Badge, statusTone } from "./ui/badge";

export function ActiveRunCard({
  run,
  compact = false,
}: {
  run: {
    _id: string;
    status: string;
    currentActivity?: string;
    createdAt?: string;
    projectId?: string;
  };
  compact?: boolean;
}) {
  const waited = formatWait(waitSeconds(run.createdAt));
  return (
    <Link
      to={`/test-runs/${run._id}`}
      className="block rounded-2xl border border-primary/30 bg-primary/5 p-5 transition hover:border-primary/60"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
            </span>
            <span className="text-sm font-semibold">{statusLabel(run.status)}</span>
            <Badge tone={statusTone(run.status)}>{run.status.replaceAll("_", " ")}</Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {run.currentActivity || statusExplanation(run.status)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">In queue / running for {waited}. Click to watch live.</p>
        </div>
      </div>
      {!compact && isLiveStatus(run.status) ? (
        <div className="mt-4">
          <RunPipeline status={run.status} />
        </div>
      ) : null}
    </Link>
  );
}
