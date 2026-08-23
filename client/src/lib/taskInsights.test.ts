import { describe, expect, it } from "vitest";
import { onTimeCompletionStats, recentCompletedTasks, sortTodoTasks, weeklyActivity } from "./taskInsights";
import type { PlannerBlock, PlanTask } from "./ongoingCalendar";

const task = (id: string, overrides: Partial<PlanTask> = {}): PlanTask => ({ id, title: id, dueAt: new Date("2026-08-23T18:00:00"), priority: "normal", course: "General", notes: "", completed: false, status: "open", createdAt: new Date("2026-08-20T10:00:00"), completedAt: null, ...overrides });
const block = (id: string, startAt: string, endAt: string): PlannerBlock => ({ id, title: id, startAt: new Date(startAt), endAt: new Date(endAt), source: "planner", completed: true });

describe("task insights", () => {
  it("keeps incomplete high-priority tasks ahead of lower-priority and completed work", () => {
    const ordered = sortTodoTasks([task("completed", { completed: true, status: "done" }), task("normal"), task("urgent", { priority: "high" })], "priority");
    expect(ordered.map(item => item.id)).toEqual(["urgent", "normal", "completed"]);
  });

  it("uses recorded completion dates and completed focus blocks for seven-day activity", () => {
    const days = weeklyActivity([task("done", { completed: true, status: "done", completedAt: new Date("2026-08-23T12:00:00") })], [block("focus", "2026-08-23T09:00:00", "2026-08-23T10:30:00")], new Date("2026-08-23T18:00:00"));
    expect(days).toHaveLength(7);
    expect(days.at(-1)).toMatchObject({ completedTasks: 1, focusMinutes: 90 });
  });

  it("reports on-time completion only for tasks with a recorded completion timestamp", () => {
    const tasks = [task("on-time", { completed: true, status: "done", completedAt: new Date("2026-08-23T17:00:00") }), task("late", { completed: true, status: "done", completedAt: new Date("2026-08-23T19:00:00") }), task("legacy", { completed: true, status: "done" })];
    expect(onTimeCompletionStats(tasks)).toEqual({ onTime: 1, timestamped: 2 });
    expect(recentCompletedTasks(tasks).map(item => item.id)).toEqual(["late", "on-time"]);
  });
});
