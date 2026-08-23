import { describe, expect, it } from "vitest";
import { deadlineCues, deadlineLabel } from "./planningContext";
import type { PlanTask } from "./ongoingCalendar";

const task = (id: string, course: string, dueAt: Date, completed = false): PlanTask => ({
  id,
  title: id,
  course,
  dueAt,
  priority: "normal",
  notes: "",
  completed,
  status: completed ? "done" : "open",
  createdAt: new Date(2026, 0, 1),
  completedAt: completed ? new Date(2026, 0, 1) : null,
  scheduledStartAt: null,
  durationMinutes: 60,
});

describe("planning deadline context", () => {
  it("keeps the nearest open deadline for each course or project without creating scores", () => {
    const now = new Date(2026, 7, 10);
    const cues = deadlineCues([
      task("later-java", "Java", new Date(2026, 7, 14)),
      task("near-java", "Java", new Date(2026, 7, 11)),
      task("stats", "Stats", new Date(2026, 7, 12)),
      task("done", "Calculus", new Date(2026, 7, 10), true),
      task("far", "Project", new Date(2026, 7, 28)),
    ], now);

    expect(cues).toEqual([
      { course: "Java", title: "near-java", dueAt: new Date(2026, 7, 11), daysAway: 1 },
      { course: "Stats", title: "stats", dueAt: new Date(2026, 7, 12), daysAway: 2 },
    ]);
  });

  it("uses plain, time-based deadline labels", () => {
    expect(deadlineLabel(-2)).toBe("2d overdue");
    expect(deadlineLabel(0)).toBe("due today");
    expect(deadlineLabel(1)).toBe("due tomorrow");
    expect(deadlineLabel(4)).toBe("due in 4d");
  });
});
