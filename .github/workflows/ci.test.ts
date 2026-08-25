import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("repository continuous integration", () => {
  it("runs type checking, tests, and the production build for MY PLAN changes", () => {
    const workflow = readFileSync(new URL("./ci.yml", import.meta.url), "utf8");
    expect(workflow).toContain("pull_request:");
    expect(workflow).toContain("pnpm check");
    expect(workflow).toContain("pnpm test");
    expect(workflow).toContain("pnpm build");
    expect(workflow).toContain("--frozen-lockfile");
  });
});
