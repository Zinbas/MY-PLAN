import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("mobile viewport accessibility", () => {
  it("does not disable browser pinch zoom", () => {
    const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
    expect(html).not.toMatch(/maximum-scale\s*=/i);
    expect(html).toContain('name="viewport"');
  });
});
