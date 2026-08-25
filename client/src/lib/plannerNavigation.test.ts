import { describe, expect, it } from "vitest";
import { isWorkspaceToolsSection } from "./plannerNavigation";

describe("planner navigation grouping", () => {
  it("keeps Settings, account, sync, import, Spark, and reminders nested beneath Workspace tools", () => {
    expect(["settings", "accounts", "sync", "import", "spark", "reminders"].every(section => isWorkspaceToolsSection(section as never))).toBe(true);
    expect(isWorkspaceToolsSection("calendar")).toBe(false);
    expect(isWorkspaceToolsSection("profile")).toBe(false);
    expect(isWorkspaceToolsSection("admin")).toBe(false);
  });
});
