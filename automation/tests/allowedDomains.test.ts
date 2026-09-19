import { describe, expect, it } from "vitest";
import { canonicalizeUrl, isAllowedUrl, normalizeDomain } from "../src/browser/allowedDomains.js";

describe("allowed domain restrictions", () => {
  it("allows the configured host and subdomains", () => {
    expect(isAllowedUrl("https://app.example.com/login", ["example.com"])).toBe(true);
    expect(isAllowedUrl("https://example.com/", ["example.com"])).toBe(true);
  });

  it("blocks unrelated hosts", () => {
    expect(isAllowedUrl("https://evil.example.net/", ["example.com"])).toBe(false);
    expect(isAllowedUrl("https://example.com.evil.test/", ["example.com"])).toBe(false);
  });

  it("normalizes domains and canonicalizes URLs", () => {
    expect(normalizeDomain("https://Shop.Example.com/path")).toBe("shop.example.com");
    expect(canonicalizeUrl("https://example.com/cart/#section")).toBe("https://example.com/cart");
  });
});
