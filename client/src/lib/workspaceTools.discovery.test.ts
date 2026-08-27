import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("MY PLAN Workspace action discovery", () => {
  it("uses direct labels for settings, reminders, connected calendars, imports, and calendar sync", async () => {
    const source = await readFile(new URL("../pages/WorkspaceTools.tsx", import.meta.url), "utf8");

    expect(source).toContain("Settings & reminders");
    expect(source).toContain('isAuthenticated ? "Connected calendars" : "Sign in to MY PLAN"');
    expect(source).toContain("Import schedule");
    expect(source).toContain("Calendar setup");
    expect(source).toContain("Calendar sync");
    expect(source).toContain('onOpen("reminders")');
    expect(source).toContain('onOpen("accounts")');
    expect(source).toContain('onOpen("import")');
    expect(source).toContain('onOpen("sync")');
  });
});
