import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("MY PLAN sidebar current-destination disclosure", () => {
  it("marks the active primary destination for assistive technologies without flattening Workspace grouping", async () => {
    const source = await readFile(new URL("../pages/PlannerSidebar.tsx", import.meta.url), "utf8");

    expect(source).toContain('aria-current={activeSection === "calendar" ? "page" : undefined}');
    expect(source).toContain('aria-current={isWorkspaceToolsSection(activeSection) ? "page" : undefined}');
    expect(source).toContain('aria-current={activeSection === "admin" ? "page" : undefined}');
  });
});
