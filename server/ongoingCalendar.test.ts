import { describe, expect, it } from "vitest";
import { addMonths, daysInMonth, isTaskComplete, isTaskScheduled, startOfWeek, taskDueState, taskEndAt, taskStatus } from "../client/src/lib/ongoingCalendar";

describe("ongoing calendar navigation", () => {
  it("moves across year boundaries without a fixed semester limit", () => {
    expect(addMonths(new Date(2026, 11, 1), 1)).toEqual(new Date(2027, 0, 1));
    expect(addMonths(new Date(2026, 0, 1), -1)).toEqual(new Date(2025, 11, 1));
  });

  it("builds complete Monday-first month grids", () => {
    const grid = daysInMonth(new Date(2027, 0, 1));
    expect(grid).toHaveLength(35);
    expect(grid.filter(Boolean)).toHaveLength(31);
    expect(startOfWeek(new Date(2026, 7, 12))).toEqual(new Date(2026, 7, 10));
  });

  it("keeps a task pending while allowing an explicit calendar time block", () => {
    const scheduledStartAt = new Date(2031, 4, 10, 18, 30);
    const task = {
      id: "task-1",
      title: "Finish revision notes",
      dueAt: new Date(2031, 4, 11, 23, 59),
      priority: "high" as const,
      course: "Calculus",
      notes: "",
      completed: false,
      scheduledStartAt,
      durationMinutes: 75,
    };

    expect(isTaskScheduled(task)).toBe(true);
    expect(taskEndAt(task)).toEqual(new Date(2031, 4, 10, 19, 45));
    expect(isTaskScheduled({ ...task, scheduledStartAt: null })).toBe(false);
  });

  it("derives durable task status from legacy completion and active workflow state", () => {
    const task = {
      id: "task-status",
      title: "Prepare project review",
      dueAt: new Date(2031, 4, 11),
      priority: "normal" as const,
      course: "Work",
      notes: "",
      completed: false,
      status: "in-progress" as const,
    };

    expect(taskStatus(task)).toBe("in-progress");
    expect(isTaskComplete(task)).toBe(false);
    expect(taskStatus({ ...task, completed: true })).toBe("done");
    expect(isTaskComplete({ ...task, status: "done" })).toBe(true);
  });

  it("groups open tasks into overdue, today, upcoming, and completed states", () => {
    const now = new Date(2031, 4, 11, 10);
    const base = {
      id: "task-due",
      title: "Read chapter",
      priority: "normal" as const,
      course: "Calculus",
      notes: "",
      completed: false,
    };

    expect(taskDueState({ ...base, dueAt: new Date(2031, 4, 10) }, now)).toBe("overdue");
    expect(taskDueState({ ...base, dueAt: new Date(2031, 4, 11, 23, 59) }, now)).toBe("today");
    expect(taskDueState({ ...base, dueAt: new Date(2031, 4, 12) }, now)).toBe("upcoming");
    expect(taskDueState({ ...base, dueAt: new Date(2031, 4, 10), completed: true }, now)).toBe("completed");
  });
});
