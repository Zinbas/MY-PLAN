import { describe, expect, it } from "vitest";
import { defaultNotificationPreferences, loadNotificationPreferences, loadReadNotificationIds, planningNotifications, saveReadNotificationIds } from "./notifications";
import { workspaceStorageKey } from "./privateWorkspace";

const task = (id: string, dueAt: string, completed = false) => ({ id, title: id, dueAt: new Date(dueAt), priority: "normal" as const, course: "Study", notes: "", completed });
const storage = () => { const data = new Map<string, string>(); return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) } as Storage; };

describe("MY PLAN notifications", () => {
  it("derives only actionable overdue, due-today, and imminent saved-plan notifications", () => {
    const now = new Date("2026-08-23T10:00:00");
    const notifications = planningNotifications([task("late", "2026-08-22T09:00:00"), task("today", "2026-08-23T18:00:00"), task("done", "2026-08-20T09:00:00", true)], [{ id: "soon", title: "Revision", startAt: new Date("2026-08-23T10:20:00"), endAt: new Date("2026-08-23T11:20:00"), source: "planner" }], now, defaultNotificationPreferences);
    expect(notifications.map(notification => notification.kind)).toEqual(["overdue", "due-today", "starting-soon"]);
    expect(notifications.map(notification => notification.title)).not.toContain("done");
  });

  it("keeps preferences and read state private to their workspace scope", () => {
    const browserStorage = storage();
    browserStorage.setItem(workspaceStorageKey("notification-preferences", "user-1"), JSON.stringify({ taskDue: false }));
    saveReadNotificationIds(browserStorage, "user-1", ["due:task-a", "due:task-a"]);
    expect(loadNotificationPreferences(browserStorage, "user-1")).toEqual({ taskDue: false, upcomingPlan: true });
    expect(loadNotificationPreferences(browserStorage, "user-2")).toEqual(defaultNotificationPreferences);
    expect(loadReadNotificationIds(browserStorage, "user-1")).toEqual(["due:task-a"]);
    expect(loadReadNotificationIds(browserStorage, "user-2")).toEqual([]);
  });
});
