import { describe, expect, it } from "vitest";
import { loadScopedBlocks, loadScopedTasks } from "./workspaceLoader";
import { workspaceStorageKey } from "./privateWorkspace";

const storage = (entries: Record<string, string>) => ({ getItem: (key: string) => entries[key] ?? null }) as Storage;

describe("scoped planner-state loading", () => {
  it("loads only the active guest, administrator, or member storage scope through the same loaders used by MY PLAN", () => {
    const entries = {
      [workspaceStorageKey("tasks", "guest")]: JSON.stringify([{ id: "guest-task", title: "Guest", dueAt: "2026-08-20T10:00:00", priority: "normal", course: "General", notes: "", completed: false }]),
      [workspaceStorageKey("tasks", "user-1")]: JSON.stringify([{ id: "admin-task", title: "Admin", dueAt: "2026-08-21T10:00:00", priority: "high", course: "Admin", notes: "", completed: false }]),
      [workspaceStorageKey("tasks", "user-2")]: JSON.stringify([{ id: "member-task", title: "Member", dueAt: "2026-08-22T10:00:00", priority: "normal", course: "Member", notes: "", completed: false }]),
      [workspaceStorageKey("blocks", "user-1")]: JSON.stringify([{ id: "admin-block", title: "Admin block", startAt: "2026-08-21T10:00:00", endAt: "2026-08-21T11:00:00", source: "planner" }]),
    };
    const browserStorage = storage(entries);
    expect(loadScopedTasks(browserStorage, "guest").map(task => task.id)).toEqual(["guest-task"]);
    expect(loadScopedTasks(browserStorage, "user-1").map(task => task.id)).toEqual(["admin-task"]);
    expect(loadScopedTasks(browserStorage, "user-2").map(task => task.id)).toEqual(["member-task"]);
    expect(loadScopedBlocks(browserStorage, "user-2")).toEqual([]);
    expect(loadScopedBlocks(browserStorage, "user-1")[0]?.startAt).toBeInstanceOf(Date);
  });
});
