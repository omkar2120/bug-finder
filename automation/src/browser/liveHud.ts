import type { Page } from "playwright";

export async function showLiveHud(page: Page, text: string) {
  const safe = JSON.stringify(text);
  await page
    .evaluate(`
      (function () {
        var next = ${safe};
        if (window.__bugpilotHudText === next) return;
        window.__bugpilotHudText = next;
        var el = document.getElementById("bugpilot-live-hud");
        if (!el) {
          el = document.createElement("div");
          el.id = "bugpilot-live-hud";
          el.setAttribute(
            "style",
            "position:fixed;top:16px;left:16px;z-index:2147483647;background:#0b1220;color:#fff;padding:12px 16px;border-radius:14px;font:600 14px/1.45 ui-sans-serif,system-ui,sans-serif;max-width:480px;box-shadow:0 10px 30px rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.18);pointer-events:none"
          );
          (document.body || document.documentElement).appendChild(el);
        }
        el.textContent = next;
      })();
    `)
    .catch(() => undefined);
}

export async function highlightTarget(page: Page, selector?: string) {
  if (!selector) return;
  await page.locator(selector).first().scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => undefined);
  await page
    .evaluate(`
      (function () {
        var el = document.querySelector(${JSON.stringify(selector)});
        if (!el || !el.style) return;
        el.style.outline = "3px solid #7c5cff";
        el.style.outlineOffset = "3px";
      })();
    `)
    .catch(() => undefined);
}

export function describeStep(step: { action: string; target?: string; value?: string; expected?: string }) {
  const target = step.target || step.value || step.expected || "";
  switch (step.action) {
    case "navigate":
      return `Opening ${target}`;
    case "click":
      return `Clicking ${target}`;
    case "type":
      return `Typing into ${step.target || "a field"}`;
    case "select":
      return `Selecting ${step.value || ""}`;
    case "submit":
      return "Submitting the form";
    case "wait":
      return "Waiting for the page";
    case "assert":
      return `Checking ${step.expected || target || "the result"}`;
    default:
      return step.action;
  }
}
