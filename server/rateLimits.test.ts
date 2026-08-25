import express from "express";
import { createServer } from "http";
import { describe, expect, it } from "vitest";
import { sensitiveRateLimit, sensitiveRouteLimits } from "./rateLimits";

describe("sensitive route rate-limit policy", () => {
  it("uses bounded windows for credential, token, costly extraction, and assistant-draft endpoints", () => {
    expect(sensitiveRouteLimits.oauthCallback).toEqual({ windowMs: 15 * 60_000, max: 30 });
    expect(sensitiveRouteLimits.mcp).toEqual({ windowMs: 60_000, max: 120 });
    expect(sensitiveRouteLimits.scheduleExtract).toEqual({ windowMs: 15 * 60_000, max: 6 });
    expect(sensitiveRouteLimits.assistantDraft).toEqual({ windowMs: 5 * 60_000, max: 20 });
  });

  it("enforces an isolated assistant-style boundary without calling the live assistant transport", async () => {
    const app = express();
    app.use(sensitiveRateLimit({ windowMs: 60_000, max: 2 }));
    app.get("/draft", (_req, res) => res.status(204).end());
    const server = createServer(app);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected a numeric test port.");
    const url = `http://127.0.0.1:${address.port}/draft`;

    try {
      expect((await fetch(url)).status).toBe(204);
      expect((await fetch(url)).status).toBe(204);
      const blocked = await fetch(url);
      expect(blocked.status).toBe(429);
      await expect(blocked.json()).resolves.toEqual({ error: "Too many requests. Please wait and try again." });
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });
});
