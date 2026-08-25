import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("managed MY PLAN title", () => {
  it("uses MY PLAN in the static page title and social metadata without requiring deployment environment variables", () => {
    const html = readFileSync(new URL("../client/index.html", import.meta.url), "utf8");
    expect(html).toContain("<title>MY PLAN</title>");
    expect(html).toContain('property="og:title" content="MY PLAN"');
  });
});
