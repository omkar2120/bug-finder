import type { Page } from "playwright";
import { isAllowedUrl } from "../browser/allowedDomains.js";
import { openAuthorizedPage, urlsMatch } from "../browser/navigate.js";
import { describeStep, highlightTarget, showLiveHud } from "../browser/liveHud.js";

export interface ExecutableStep {
  order: number;
  action: "navigate" | "click" | "type" | "select" | "submit" | "wait" | "assert";
  target?: string;
  value?: string;
  expected?: string;
}

export interface ExecutableTest {
  name: string;
  steps: ExecutableStep[];
  expectedResult: string;
}

export interface ExecutionResult {
  status: "passed" | "failed" | "blocked";
  actualResult: string;
  pageUrl?: string;
  screenshot?: Buffer;
  error?: { type: string; message: string; stack?: string };
  durationMs: number;
}

export async function executeTest(
  page: Page,
  test: ExecutableTest,
  allowedDomains: string[],
  options?: {
    headed?: boolean;
    captureScreenshots?: boolean;
    onStep?: (info: { step: ExecutableStep; index: number; total: number; label: string; pageUrl: string }) => Promise<void> | void;
  },
): Promise<ExecutionResult> {
  const started = Date.now();
  const headed = Boolean(options?.headed);
  try {
    for (let index = 0; index < test.steps.length; index += 1) {
      const step = test.steps[index];
      const label = describeStep(step);
      if (headed) {
        await showLiveHud(page, `${test.name}\n${index + 1}/${test.steps.length} · ${label}`);
        await highlightTarget(page, step.target);
        await page.waitForTimeout(700);
      }
      await options?.onStep?.({
        step,
        index,
        total: test.steps.length,
        label,
        pageUrl: page.url(),
      });
      await runStep(page, step, allowedDomains);
      if (headed) await page.waitForTimeout(500);
    }
    const pageUrl = page.url();
    const screenshot = options?.captureScreenshots
      ? await page.screenshot({ type: "png", fullPage: false }).catch(() => undefined)
      : undefined;
    return {
      status: "passed",
      actualResult: test.expectedResult,
      pageUrl,
      screenshot,
      durationMs: Date.now() - started,
    };
  } catch (error) {
    const pageUrl = page.url();
    const screenshot = await page.screenshot({ type: "png", fullPage: false }).catch(() => undefined);
    return {
      status: "failed",
      actualResult: error instanceof Error ? error.message : String(error),
      pageUrl,
      screenshot,
      error: {
        type: error instanceof Error ? error.name : "Error",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      durationMs: Date.now() - started,
    };
  }
}

async function runStep(page: Page, step: ExecutableStep, allowedDomains: string[]) {
  switch (step.action) {
    case "navigate": {
      const url = step.value || step.target;
      if (!url) throw new Error("Navigate step is missing a URL");
      if (!isAllowedUrl(url, allowedDomains)) {
        throw new Error(`Blocked navigation to unauthorized domain: ${url}`);
      }
      await openAuthorizedPage(page, url);
      break;
    }
    case "click": {
      if (!step.target) throw new Error("Click step is missing a target");
      await page.locator(step.target).first().click({ timeout: 8000 });
      break;
    }
    case "type": {
      if (!step.target) throw new Error("Type step is missing a target");
      await page.locator(step.target).first().fill(step.value ?? "", { timeout: 8000 });
      break;
    }
    case "select": {
      if (!step.target || !step.value) throw new Error("Select step is missing target or value");
      await page.locator(step.target).first().selectOption(step.value, { timeout: 8000 });
      break;
    }
    case "submit": {
      if (step.target) {
        await page.locator(step.target).first().press("Enter");
      } else {
        await page.keyboard.press("Enter");
      }
      await page.waitForTimeout(400);
      break;
    }
    case "wait": {
      await page.waitForTimeout(Number(step.value ?? 500));
      break;
    }
    case "assert": {
      const expected = (step.expected || step.value || "").trim();
      if (expected === ":invalid" || expected === "aria-invalid") {
        const target = step.target || "input, select, textarea";
        if (expected === "aria-invalid") {
          await page.locator(`${step.target || "input,select,textarea"}[aria-invalid='true']`).first().waitFor({ timeout: 5000 });
        } else {
          await page.locator(`${target}:invalid`).first().waitFor({ timeout: 5000 });
        }
        break;
      }
      if (step.target) {
        const locator = page.locator(step.target).first();
        if (step.expected) {
          await locator.filter({ hasText: step.expected }).waitFor({ timeout: 5000 });
        } else {
          await locator.waitFor({ timeout: 5000 });
        }
      } else if (step.expected) {
        await page
          .locator("[role='alert'], .error, .invalid-feedback, .field-error, .help-block, [data-error]")
          .filter({ hasText: step.expected })
          .first()
          .waitFor({ timeout: 2500 })
          .catch(async () => {
            await page.getByText(step.expected!, { exact: false }).first().waitFor({ timeout: 5000 });
          });
      } else if (step.value) {
        if (!urlsMatch(page.url(), step.value) && !page.url().includes(step.value)) {
          throw new Error(`Expected URL to include ${step.value}, got ${page.url()}`);
        }
      }
      break;
    }
    default:
      throw new Error(`Unsupported step action: ${step.action}`);
  }
}
