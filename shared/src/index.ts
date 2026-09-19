export const API_PREFIX = "/api/v1";

export type Role = "admin" | "qa_engineer" | "viewer";
export type ProjectStatus = "active" | "archived";
export type Environment = "prod" | "qa" | "uat";
export type BrowserName = "chromium" | "firefox" | "webkit";

export type TestRunStatus =
  | "queued"
  | "discovering"
  | "generating_tests"
  | "running"
  | "analyzing"
  | "completed"
  | "failed"
  | "cancelled";

export type TestType =
  | "functional"
  | "negative"
  | "boundary"
  | "validation"
  | "navigation"
  | "session"
  | "api"
  | "accessibility"
  | "content";

export type TestPriority = "critical" | "high" | "medium" | "low";
export type TestResultStatus = "passed" | "failed" | "skipped" | "blocked";

export type BugCategory =
  | "functional"
  | "validation"
  | "api"
  | "authentication"
  | "authorization"
  | "content"
  | "accessibility"
  | "performance"
  | "ui"
  | "security"
  | "other";

export type Severity = "critical" | "high" | "medium" | "low";
export type BugPriority = "P0" | "P1" | "P2" | "P3";
export type BugStatus =
  | "new"
  | "confirmed"
  | "duplicate"
  | "false_positive"
  | "resolved"
  | "reopened";

export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "OPTIONS"
  | "HEAD";

export type ApiResult =
  | "success"
  | "client_error"
  | "server_error"
  | "network_error"
  | "timeout";

export type ContentIssueType =
  | "spelling"
  | "grammar"
  | "broken_text"
  | "placeholder"
  | "inconsistent_label"
  | "translation"
  | "undefined_text"
  | "other";

export type AccessibilitySeverity = "critical" | "serious" | "moderate" | "minor";

export type TestStepAction =
  | "navigate"
  | "click"
  | "type"
  | "select"
  | "submit"
  | "wait"
  | "assert";

export type SseEventType =
  | "TEST_RUN_STARTED"
  | "PAGE_DISCOVERED"
  | "TEST_GENERATED"
  | "TEST_STARTED"
  | "TEST_PASSED"
  | "TEST_FAILED"
  | "API_CAPTURED"
  | "CONTENT_ISSUE_FOUND"
  | "ACCESSIBILITY_ISSUE_FOUND"
  | "PERFORMANCE_ISSUE_FOUND"
  | "BUG_DETECTED"
  | "AI_ANALYSIS_STARTED"
  | "AI_ANALYSIS_COMPLETED"
  | "TEST_RUN_COMPLETED"
  | "TEST_RUN_FAILED"
  | "TEST_RUN_CANCELLED"
  | "ACTIVITY";

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface TestStep {
  order: number;
  action: TestStepAction;
  target?: string;
  value?: string;
  expected?: string;
}

export interface GeneratedTest {
  name: string;
  description?: string;
  type: TestType;
  priority: TestPriority;
  preconditions?: string[];
  steps: TestStep[];
  expectedResult: string;
  confidence?: number;
}
