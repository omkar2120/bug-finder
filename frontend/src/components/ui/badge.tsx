import { cn } from "@/lib/utils";

const tones: Record<string, string> = {
  default: "bg-secondary text-secondary-foreground",
  success: "bg-emerald-500/15 text-emerald-400",
  warning: "bg-amber-500/15 text-amber-400",
  danger: "bg-red-500/15 text-red-400",
  info: "bg-sky-500/15 text-sky-300",
  accent: "bg-primary/15 text-primary",
};

export function Badge({
  className,
  tone = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}
      {...props}
    />
  );
}

export function statusTone(status?: string) {
  if (!status) return "default" as const;
  if (["completed", "passed", "resolved", "success", "active"].includes(status)) return "success" as const;
  if (["failed", "critical", "error", "cancelled"].includes(status)) return "danger" as const;
  if (["queued", "running", "discovering", "analyzing", "generating_tests", "new", "high"].includes(status)) return "warning" as const;
  return "info" as const;
}
