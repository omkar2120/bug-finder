import type { Page } from "playwright";
import type { DiscoveredElement } from "./types.js";

export async function extractInteractiveElements(page: Page): Promise<DiscoveredElement[]> {
  return page.evaluate(() => {
    const interesting = Array.from(
      document.querySelectorAll(
        "a, button, input, select, textarea, [role='button'], [role='link'], [role='dialog'], [role='navigation'], table, img, [onclick]",
      ),
    ).slice(0, 200);

    const cssPath = (el: Element) => {
      if (el.id) return `#${CSS.escape(el.id)}`;
      const parts: string[] = [];
      let node: Element | null = el;
      while (node && parts.length < 5) {
        const tag = node.tagName.toLowerCase();
        const parent: Element | null = node.parentElement;
        if (!parent) {
          parts.unshift(tag);
          break;
        }
        const same = Array.from(parent.children).filter((child) => (child as Element).tagName === node!.tagName);
        const nth = same.indexOf(node) + 1;
        parts.unshift(same.length > 1 ? `${tag}:nth-of-type(${nth})` : tag);
        node = parent;
      }
      return parts.join(" > ");
    };

    return interesting.map((el) => {
      const input = el as HTMLInputElement;
      const id = el.id;
      const label =
        (id && document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent) ||
        el.closest("label")?.textContent ||
        input.getAttribute("aria-label") ||
        "";
      return {
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute("type") ?? undefined,
        text: (el.textContent || "").trim().slice(0, 120) || undefined,
        name: el.getAttribute("name") ?? undefined,
        id: id || undefined,
        selector: cssPath(el),
        role: el.getAttribute("role") ?? undefined,
        href: el.getAttribute("href") ?? undefined,
        placeholder: input.placeholder || undefined,
        inputType: input.type || undefined,
        required: Boolean(input.required || input.getAttribute("aria-required") === "true"),
        pattern: input.pattern || undefined,
        minLength: input.minLength > 0 ? input.minLength : undefined,
        maxLength: input.maxLength > 0 ? input.maxLength : undefined,
        label: label.replace(/\s+/g, " ").trim().slice(0, 80) || undefined,
      };
    });
  });
}

export async function extractTextSamples(page: Page) {
  return page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll("h1, h2, h3, h4, label, button, a, p, li, th, td, span"));
    return nodes
      .map((el) => ({
        selector: el.id ? `#${el.id}` : el.tagName.toLowerCase(),
        tag: el.tagName.toLowerCase(),
        text: (el.textContent || "").replace(/\s+/g, " ").trim(),
      }))
      .filter((item) => item.text.length > 1 && item.text.length < 180)
      .slice(0, 80);
  });
}

export async function collectAccessibilityIssues(page: Page) {
  return page.evaluate(() => {
    const issues: Array<{
      ruleId: string;
      impact: "critical" | "serious" | "moderate" | "minor";
      description: string;
      help: string;
      selector?: string;
      html?: string;
    }> = [];

    document.querySelectorAll("img").forEach((img) => {
      if (!img.getAttribute("alt") && !img.getAttribute("role")) {
        issues.push({
          ruleId: "image-alt",
          impact: "serious",
          description: "Image is missing alternative text",
          help: "Add a meaningful alt attribute to convey the image purpose.",
          selector: img.id ? `#${img.id}` : "img",
          html: img.outerHTML.slice(0, 240),
        });
      }
    });

    document.querySelectorAll("input, select, textarea").forEach((field) => {
      const id = field.id;
      const labelled =
        field.getAttribute("aria-label") ||
        field.getAttribute("aria-labelledby") ||
        (id && document.querySelector(`label[for="${id}"]`)) ||
        field.closest("label");
      if (!labelled) {
        issues.push({
          ruleId: "label",
          impact: "critical",
          description: "Form control is missing an accessible name",
          help: "Associate a label or aria-label with this control.",
          selector: id ? `#${id}` : field.tagName.toLowerCase(),
          html: field.outerHTML.slice(0, 240),
        });
      }
    });

    const headings = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6")).map((h) =>
      Number(h.tagName.substring(1)),
    );
    for (let i = 1; i < headings.length; i += 1) {
      if (headings[i] - headings[i - 1] > 1) {
        issues.push({
          ruleId: "heading-order",
          impact: "moderate",
          description: "Heading levels skip a rank",
          help: "Keep heading hierarchy sequential.",
        });
        break;
      }
    }

    if (!document.querySelector("[role='main'], main")) {
      issues.push({
        ruleId: "landmark-main",
        impact: "moderate",
        description: "Page is missing a main landmark",
        help: "Add a <main> element or role=main.",
      });
    }

    document.querySelectorAll("[onclick]").forEach((el) => {
      const tabbable = el instanceof HTMLElement && el.tabIndex >= 0;
      const role = el.getAttribute("role");
      if (!tabbable && !["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"].includes(el.tagName) && !role) {
        issues.push({
          ruleId: "keyboard",
          impact: "serious",
          description: "Interactive element may not be keyboard accessible",
          help: "Use a native button/link or add tabindex and a keyboard handler.",
          selector: el.id ? `#${el.id}` : el.tagName.toLowerCase(),
          html: el.outerHTML.slice(0, 240),
        });
      }
    });

    return issues.slice(0, 50);
  });
}

export async function collectPerformance(page: Page) {
  return page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const transferSizeBytes = resources.reduce((sum, r) => sum + (r.transferSize || 0), 0);
    return {
      ttfbMs: nav ? Math.round(nav.responseStart) : undefined,
      domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd) : undefined,
      loadMs: nav ? Math.round(nav.loadEventEnd) : undefined,
      transferSizeBytes,
      failedRequests: 0,
    };
  });
}
