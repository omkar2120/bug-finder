export interface DiscoveredElement {
  tag: string;
  type?: string;
  text?: string;
  name?: string;
  id?: string;
  selector: string;
  role?: string;
  href?: string;
  placeholder?: string;
  inputType?: string;
  required?: boolean;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  label?: string;
}

export interface DiscoveredPage {
  url: string;
  title: string;
  depth: number;
  elements: DiscoveredElement[];
  textSamples: Array<{ selector: string; tag: string; text: string }>;
  screenshot?: Buffer;
  consoleErrors: Array<{ level: string; message: string }>;
  performance?: {
    ttfbMs?: number;
    domContentLoadedMs?: number;
    loadMs?: number;
    transferSizeBytes?: number;
    failedRequests: number;
  };
}

export interface CapturedApi {
  method: string;
  url: string;
  endpoint: string;
  requestHeaders: Record<string, string>;
  requestBody?: unknown;
  responseStatus?: number;
  responseStatusText?: string;
  responseHeaders: Record<string, string>;
  responseBody?: unknown;
  sizeBytes?: number;
  durationMs: number;
  ttfbMs?: number;
  result: "success" | "client_error" | "server_error" | "network_error" | "timeout";
  pageUrl?: string;
}

export interface DiscoveryResult {
  pages: DiscoveredPage[];
  apis: CapturedApi[];
  stoppedReason: string;
}
