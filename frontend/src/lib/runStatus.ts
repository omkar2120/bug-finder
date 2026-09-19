export const RUN_STEPS = [
  { id: "queued", label: "Queued", hint: "Waiting for the AI engineer" },
  { id: "discovering", label: "Discover", hint: "Opening pages and mapping the app" },
  { id: "generating_tests", label: "Generate", hint: "Writing structured tests" },
  { id: "running", label: "Execute", hint: "Playwright is running the tests" },
  { id: "analyzing", label: "Analyze", hint: "Confirming real bugs, not every failure" },
  { id: "completed", label: "Done", hint: "Results are saved in MongoDB" },
] as const;

export type LiveRunStatus =
  | "queued"
  | "discovering"
  | "generating_tests"
  | "running"
  | "analyzing"
  | "completed"
  | "failed"
  | "cancelled";

export function isLiveStatus(status?: string) {
  return ["queued", "discovering", "generating_tests", "running", "analyzing"].includes(status ?? "");
}

export function statusLabel(status?: string) {
  switch (status) {
    case "queued":
      return "In queue";
    case "discovering":
      return "Discovering app";
    case "generating_tests":
      return "Generating tests";
    case "running":
      return "Running tests";
    case "analyzing":
      return "AI investigating";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return status?.replaceAll("_", " ") ?? "Unknown";
  }
}

export function statusExplanation(status?: string) {
  switch (status) {
    case "queued":
      return "Your test is waiting to start. BugPilot will open the authorized URL next, then discover pages and generate tests.";
    case "discovering":
      return "The AI engineer is crawling only the domains you authorized and capturing pages, screenshots, and APIs.";
    case "generating_tests":
      return "Structured JSON tests are being created from the pages and forms that were just discovered.";
    case "running":
      return "Playwright is executing those tests in Chromium and collecting evidence for every step.";
    case "analyzing":
      return "Failures are being classified. Only confirmed application defects become bugs.";
    case "completed":
      return "This run finished. Open bugs, APIs, and the report for evidence.";
    case "failed":
      return "The run stopped before it could finish. Check the error details and try again.";
    case "cancelled":
      return "This run was cancelled before completion.";
    default:
      return "Live status from MongoDB.";
  }
}

export function pipelineIndex(status?: string) {
  if (status === "failed" || status === "cancelled") return -1;
  const index = RUN_STEPS.findIndex((step) => step.id === status);
  return index >= 0 ? index : 0;
}

export function waitSeconds(from?: string | Date) {
  if (!from) return 0;
  return Math.max(0, Math.round((Date.now() - new Date(from).getTime()) / 1000));
}

export function formatWait(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}m ${rest}s`;
}
