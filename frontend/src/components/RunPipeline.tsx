import type { ReactNode } from "react";
import { pipelineIndex, RUN_STEPS, statusExplanation, statusLabel } from "@/lib/runStatus";
import { cn } from "@/lib/utils";

export function RunPipeline({ status }: { status?: string }) {
  const current = pipelineIndex(status);
  const failed = status === "failed" || status === "cancelled";

  return (
    <ol className="grid gap-2 sm:grid-cols-6">
      {RUN_STEPS.map((step, index) => {
        const done = !failed && current > index;
        const active = !failed && current === index;
        return (
          <li
            key={step.id}
            className={cn(
              "relative rounded-xl border px-3 py-3",
              done && "border-primary/40 bg-primary/10",
              active && "border-primary bg-primary/15 shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]",
              !done && !active && "border-border bg-muted/30",
              failed && index === 0 && "border-destructive/40 bg-destructive/10",
            )}
          >
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[10px]",
                  done && "bg-primary text-primary-foreground",
                  active && "animate-pulse bg-primary text-primary-foreground",
                  !done && !active && "bg-secondary",
                )}
              >
                {done ? "✓" : index + 1}
              </span>
              {step.label}
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{step.hint}</p>
          </li>
        );
      })}
    </ol>
  );
}

export function QueuedHero({
  status,
  activity,
  waited,
  action,
}: {
  status?: string;
  activity?: string;
  waited?: string;
  action?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-card to-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
            <span className="h-2 w-2 animate-ping rounded-full bg-primary" />
            {statusLabel(status)}
          </div>
          <h2 className="mt-3 text-2xl font-semibold">AI QA engineer is getting ready</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{statusExplanation(status)}</p>
          <p className="mt-3 text-sm">
            <span className="text-muted-foreground">Now: </span>
            {activity || "Waiting for the next available worker"}
            {waited ? <span className="text-muted-foreground"> · waiting {waited}</span> : null}
          </p>
          {action ? <div className="mt-4">{action}</div> : null}
        </div>
      </div>
      <div className="mt-6">
        <RunPipeline status={status} />
      </div>
    </div>
  );
}
