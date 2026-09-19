import type { Page } from "playwright";
import { BrowserSession, type BrowserName } from "../browser/session.js";
import { showLiveHud } from "../browser/liveHud.js";
import { canonicalizeUrl, isAllowedUrl } from "../browser/allowedDomains.js";
import { openAuthorizedPage } from "../browser/navigate.js";
import { collectAccessibilityIssues, collectPerformance, extractInteractiveElements, extractTextSamples } from "./extract.js";
import type { DiscoveredPage, DiscoveryResult } from "./types.js";

export interface DiscoveryOptions {
  startUrl: string;
  allowedDomains: string[];
  maxPages: number;
  maxDepth: number;
  maxDurationSeconds: number;
  browser: BrowserName;
  headless?: boolean;
  seedUrls?: string[];
  followLinks?: boolean;
  session?: BrowserSession;
  page?: Page;
  keepOpen?: boolean;
  headed?: boolean;
  captureScreenshots?: boolean;
  credentials?: { username: string; password: string };
  shouldStop?: () => Promise<boolean> | boolean;
  onPage?: (page: DiscoveredPage, stats: { pages: number; apis: number }) => Promise<void> | void;
}

export async function discoverApplication(options: DiscoveryOptions): Promise<DiscoveryResult> {
  const ownsSession = !options.session;
  const session =
    options.session ??
    new BrowserSession({
      browser: options.browser,
      headless: options.headless,
      allowedDomains: options.allowedDomains,
    });
  if (!options.session) await session.start();
  const page = options.page ?? (await session.newPage());
  const headed = Boolean(options.headed);
  const started = Date.now();
  const deadline = started + options.maxDurationSeconds * 1000;
  const seeds = (options.seedUrls?.length ? options.seedUrls : [options.startUrl])
    .map((url) => {
      try {
        return canonicalizeUrl(new URL(url, options.startUrl).toString());
      } catch {
        return "";
      }
    })
    .filter((url) => url && isAllowedUrl(url, options.allowedDomains));
  const queue: Array<{ url: string; depth: number }> = (seeds.length ? seeds : [canonicalizeUrl(options.startUrl)]).map(
    (url) => ({ url, depth: 0 }),
  );
  const followLinks = options.followLinks !== false;
  const seen = new Set<string>();
  const pages: DiscoveredPage[] = [];
  let stoppedReason = "completed";

  try {
    while (queue.length > 0) {
      if (await options.shouldStop?.()) {
        stoppedReason = "cancelled";
        break;
      }
      if (Date.now() > deadline) {
        stoppedReason = "max_duration";
        break;
      }
      if (pages.length >= options.maxPages) {
        stoppedReason = "max_pages";
        break;
      }

      const next = queue.shift()!;
      if (seen.has(next.url)) continue;
      if (!isAllowedUrl(next.url, options.allowedDomains)) continue;
      seen.add(next.url);

      if (headed) await showLiveHud(page, `Looking at ${next.url}`);
      const discovered = await crawlPage(
        page,
        next.url,
        next.depth,
        options.allowedDomains,
        headed,
        options.captureScreenshots === true,
      );
      if (!discovered) continue;
      pages.push(discovered);
      await options.onPage?.(discovered, { pages: pages.length, apis: session.apis.length });

      if (followLinks && next.depth < options.maxDepth) {
        for (const el of discovered.elements) {
          if (el.tag === "a" && el.href) {
            try {
              const absolute = canonicalizeUrl(new URL(el.href, discovered.url).toString());
              if (!seen.has(absolute) && isAllowedUrl(absolute, options.allowedDomains)) {
                queue.push({ url: absolute, depth: next.depth + 1 });
              }
            } catch {
              // ignore invalid hrefs
            }
          }
        }
      }
    }
  } finally {
    if (ownsSession && !options.keepOpen) await session.close();
  }

  return {
    pages,
    apis: session.apis,
    stoppedReason,
  };
}

async function crawlPage(
  page: Page,
  url: string,
  depth: number,
  allowedDomains: string[],
  headed = false,
  captureScreenshots = false,
): Promise<DiscoveredPage | null> {
  if (!isAllowedUrl(url, allowedDomains)) return null;
  try {
    await openAuthorizedPage(page, url);
    await page.waitForTimeout(headed ? 400 : 250);
  } catch {
    return null;
  }

  const [elements, textSamples, screenshot, performance] = await Promise.all([
    extractInteractiveElements(page),
    extractTextSamples(page),
    captureScreenshots
      ? page.screenshot({ fullPage: false, type: "png" }).catch(() => undefined)
      : Promise.resolve(undefined),
    collectPerformance(page).catch(() => undefined),
  ]);

  return {
    url: page.url(),
    title: await page.title().catch(() => ""),
    depth,
    elements,
    textSamples,
    screenshot,
    consoleErrors: [],
    performance,
  };
}

export { collectAccessibilityIssues };
