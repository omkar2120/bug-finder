import type { Page } from "playwright";

function hostnameOf(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function urlsMatch(actual: string, expected: string) {
  const a = hostnameOf(actual);
  const b = hostnameOf(expected);
  if (a && b) return a === b;
  return actual.includes(expected) || expected.includes(actual);
}

export async function openAuthorizedPage(page: Page, url: string) {
  try {
    await page.goto(url, { waitUntil: "commit", timeout: 45000 });
  } catch (error) {
    if (urlsMatch(page.url(), url) && (await pageHasContent(page))) return;
    throw error;
  }

  await page.waitForLoadState("domcontentloaded", { timeout: 20000 }).catch(() => undefined);
  await page.waitForLoadState("load", { timeout: 8000 }).catch(() => undefined);
  await page.waitForTimeout(400);

  if (!urlsMatch(page.url(), url) && !(await pageHasContent(page))) {
    throw new Error(`Navigation did not reach ${url}. Now at ${page.url() || "about:blank"}`);
  }
}

async function pageHasContent(page: Page) {
  const text = await page
    .evaluate(`(document.body && document.body.innerText ? document.body.innerText : "").trim().slice(0, 80)`)
    .catch(() => "");
  return Boolean(text);
}
