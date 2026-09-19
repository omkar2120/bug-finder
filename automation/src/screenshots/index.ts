import type { Page } from "playwright";

export async function captureViewport(page: Page) {
  return page.screenshot({ type: "png", fullPage: false });
}
