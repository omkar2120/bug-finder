export { discoverApplication, collectAccessibilityIssues } from "./discovery/engine.js";
export { executeTest } from "./execution/runner.js";
export { BrowserSession } from "./browser/session.js";
export { showLiveHud, describeStep } from "./browser/liveHud.js";
export { isAllowedUrl, canonicalizeUrl, normalizeDomain } from "./browser/allowedDomains.js";
export { openAuthorizedPage, urlsMatch } from "./browser/navigate.js";
export { sanitizeHeaders, sanitizeBody, classifyHttpResult } from "./network/sanitize.js";
export type { DiscoveryResult, DiscoveredPage, CapturedApi, DiscoveredElement } from "./discovery/types.js";
export type { ExecutableTest, ExecutionResult } from "./execution/runner.js";
