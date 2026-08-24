import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("MY PLAN push service worker", () => {
  it("keeps notification click routing same-origin and limited to private planner sections", async () => {
    const source = await readFile(new URL("../../public/my-plan-sw.js", import.meta.url), "utf8");
    expect(source).toContain("url.origin !== self.location.origin");
    expect(source).toContain('section !== "calendar" && section !== "todo"');
    expect(source).toContain("MY PLAN ·");
  });
});
