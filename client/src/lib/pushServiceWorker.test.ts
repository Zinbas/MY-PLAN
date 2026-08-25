import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("MY PLAN push service worker", () => {
  it("keeps notification click routing same-origin and limited to private planner sections", async () => {
    const source = await readFile(new URL("../../public/my-plan-sw.js", import.meta.url), "utf8");
    expect(source).toContain("url.origin !== self.location.origin");
    expect(source).toContain('section !== "calendar" && section !== "todo"');
    expect(source).toContain("MY PLAN ·");
  });

  it("uses the existing safe worker for installability while caching only the public application shell", async () => {
    const source = await readFile(new URL("../../public/my-plan-sw.js", import.meta.url), "utf8");
    expect(source).toContain('const shellCacheName = "my-plan-shell-v1"');
    expect(source).toContain('event.request.mode !== "navigate"');
    expect(source).not.toContain("/api/trpc");
  });
});
