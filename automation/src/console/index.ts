export interface ConsoleEntry {
  pageUrl: string;
  level: string;
  message: string;
}

export function normalizeConsoleLevel(level: string) {
  if (["error", "warning", "info", "debug", "log"].includes(level)) return level;
  return "log";
}
