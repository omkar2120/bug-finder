import { chromium, firefox, webkit, type Browser, type BrowserContext, type Page } from "playwright";
import { sanitizeHeaders, tryParseBody, classifyHttpResult, endpointFromUrl } from "../network/sanitize.js";
import type { CapturedApi } from "../discovery/types.js";

export type BrowserName = "chromium" | "firefox" | "webkit";

export interface SessionOptions {
  browser: BrowserName;
  headless?: boolean;
  allowedDomains: string[];
}

const launchers = { chromium, firefox, webkit };

export class BrowserSession {
  browser?: Browser;
  context?: BrowserContext;
  apis: CapturedApi[] = [];
  consoleLogs: Array<{ pageUrl: string; level: string; message: string }> = [];

  constructor(private readonly options: SessionOptions) {}

  async start() {
    const launcher = launchers[this.options.browser] ?? chromium;
    const headless = this.options.headless ?? true;
    const launchOptions = { headless, slowMo: headless ? 0 : 450 };
    try {
      this.browser = await launcher.launch({
        ...launchOptions,
        ...(headless || this.options.browser !== "chromium" ? {} : { channel: "chrome" }),
      });
    } catch {
      this.browser = await launcher.launch(launchOptions);
    }
    this.context = await this.browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1440, height: 900 },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    });
    this.context.setDefaultNavigationTimeout(45000);
    this.context.setDefaultTimeout(15000);
    // tsx/esbuild keepNames injects __name() into functions Playwright
    // serializes into the page. Define a no-op so evaluate() works in dev.
    await this.context.addInitScript("globalThis.__name = globalThis.__name || (target => target);");
    this.context.on("page", (page) => this.attachPageListeners(page));
    return this.context;
  }

  attachPageListeners(page: Page) {
    page.on("console", (msg) => {
      this.consoleLogs.push({
        pageUrl: page.url(),
        level: msg.type(),
        message: msg.text().slice(0, 2000),
      });
    });
    page.on("pageerror", (error) => {
      this.consoleLogs.push({
        pageUrl: page.url(),
        level: "error",
        message: error.message.slice(0, 2000),
      });
    });
    page.on("requestfinished", async (request) => {
      await this.captureRequest(request, page.url(), false);
    });
    page.on("requestfailed", async (request) => {
      await this.captureRequest(request, page.url(), true);
    });
  }

  private async captureRequest(request: import("playwright").Request, pageUrl: string, failed: boolean) {
    const resourceType = request.resourceType();
    if (!["xhr", "fetch"].includes(resourceType)) return;
    const response = await request.response().catch(() => null);
    const timing = request.timing();
    const headers = sanitizeHeaders(request.headers());
    let requestBody: unknown;
    try {
      requestBody = tryParseBody(request.postData() ?? undefined);
    } catch {
      requestBody = undefined;
    }
    let responseBody: unknown;
    let sizeBytes: number | undefined;
    if (response) {
      const text = await response.text().catch(() => "");
      sizeBytes = Buffer.byteLength(text);
      responseBody = tryParseBody(text);
    }
    const durationMs = Math.max(0, timing.responseEnd || 0);
    this.apis.push({
      method: request.method().toUpperCase(),
      url: request.url(),
      endpoint: endpointFromUrl(request.url()),
      requestHeaders: headers,
      requestBody,
      responseStatus: response?.status(),
      responseStatusText: response?.statusText(),
      responseHeaders: response ? sanitizeHeaders(response.headers()) : {},
      responseBody,
      sizeBytes,
      durationMs,
      ttfbMs: timing.responseStart > 0 ? timing.responseStart : undefined,
      result: classifyHttpResult(response?.status(), failed, durationMs > 30000),
      pageUrl,
    });
  }

  async newPage() {
    if (!this.context) throw new Error("Browser session not started");
    const page = await this.context.newPage();
    this.attachPageListeners(page);
    return page;
  }

  async close() {
    try {
      for (const page of this.context?.pages() ?? []) {
        await page.close({ runBeforeUnload: false }).catch(() => undefined);
      }
    } catch {
      // already closing
    }
    await this.context?.close().catch(() => undefined);
    await this.browser?.close().catch(() => undefined);
    this.context = undefined;
    this.browser = undefined;
  }
}
