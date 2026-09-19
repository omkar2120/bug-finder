import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "good" | "warn" | "bad" | "accent";
}) {
  return (
    <div
      className={cn(
        "stat-card",
        tone === "good" && "border-emerald-500/20",
        tone === "warn" && "border-amber-500/20",
        tone === "bad" && "border-red-500/20",
        tone === "accent" && "border-primary/25",
      )}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-2 text-3xl font-semibold tracking-tight",
          tone === "good" && "text-emerald-400",
          tone === "warn" && "text-amber-400",
          tone === "bad" && "text-red-400",
          tone === "accent" && "text-primary",
        )}
      >
        {value}
      </div>
      {hint ? <p className="mt-2 text-xs leading-5 text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
