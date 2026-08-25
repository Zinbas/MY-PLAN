import { describe, expect, it } from "vitest";
import { isWorkspaceToolsSection, showsAssistantShortcut } from "./plannerNavigation";

describe("planner navigation grouping", () => {
  it("keeps Settings, account, sync, import, Spark, and reminders nested beneath Workspace tools", () => {
    expect(["settings", "accounts", "sync", "import", "spark", "reminders"].every(section => isWorkspaceToolsSection(section as never))).toBe(true);
    expect(isWorkspaceToolsSection("calendar")).toBe(false);
    expect(isWorkspaceToolsSection("profile")).toBe(false);
    expect(isWorkspaceToolsSection("admin")).toBe(false);
  });

  it("shows the Assistant shortcut only on the requested main planning sections", () => {
    expect(["calendar", "todo", "progress", "profile"].every(section => showsAssistantShortcut(section as never))).toBe(true);
    expect(["tools", "settings", "accounts", "sync", "import", "spark", "assistant", "reminders", "admin", "welcome"].some(section => showsAssistantShortcut(section as never))).toBe(false);
  });
});
