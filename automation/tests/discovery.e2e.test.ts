import http from "node:http";
import { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { discoverApplication } from "../src/discovery/engine.js";

function startFixtureServer() {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<!doctype html>
      <html><head><title>Fixture Shop</title></head>
      <body>
        <h1>Checkout</h1>
        <label for="email">Email</label>
        <input id="email" type="email" />
        <label for="qty">Quantity</label>
        <input id="qty" name="quantity" />
        <button type="submit">Place order</button>
        <p>Adress</p>
        <img src="about:blank" />
      </body></html>`);
  });
  return new Promise<{ server: http.Server; url: string }>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, url: `http://127.0.0.1:${port}/` });
    });
  });
}

describe("Playwright discovery", () => {
  it("discovers an authorized local page and respects the allow-list", async () => {
    const { server, url } = await startFixtureServer();
    try {
      const host = new URL(url).hostname;
      const result = await discoverApplication({
        startUrl: url,
        allowedDomains: [host],
        maxPages: 2,
        maxDepth: 1,
        maxDurationSeconds: 20,
        browser: "chromium",
        headless: true,
      });
      expect(result.pages.length).toBeGreaterThan(0);
      expect(result.pages[0].title).toBe("Fixture Shop");
      expect(result.pages[0].elements.some((el) => el.inputType === "email")).toBe(true);
    } finally {
      server.close();
    }
  }, 45000);
});
