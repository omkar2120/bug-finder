import { describe, expect, it } from "vitest";
import { isUrlAllowed, normalizeDomain } from "../src/services/domainService.js";

describe("domain authorization", () => {
  it("only allows explicitly authorized hosts", () => {
    expect(isUrlAllowed("https://shop.acme.test/cart", ["acme.test"])).toBe(true);
    expect(isUrlAllowed("https://other.test/", ["acme.test"])).toBe(false);
  });

  it("normalizes protocol prefixes", () => {
    expect(normalizeDomain("https://App.ACME.test/login")).toBe("app.acme.test");
  });
});
