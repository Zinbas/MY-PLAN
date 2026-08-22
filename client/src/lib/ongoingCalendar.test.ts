import { describe, expect, it } from "vitest";
import { findTimeConflicts, type PlannerBlock } from "./ongoingCalendar";

const block = (id: string, start: string, end: string, source: PlannerBlock["source"] = "planner"): PlannerBlock => ({ id, title: id, startAt: new Date(start), endAt: new Date(end), source });

describe("global time conflict detection", () => {
  it("finds overlaps across personal, linked, academic, task, and planner sources", () => {
    const candidate = block("new", "2026-09-01T10:00:00", "2026-09-01T11:00:00");
    const existing = [
      block("personal", "2026-09-01T10:30:00", "2026-09-01T11:30:00", "event"),
      block("linked", "2026-09-01T09:45:00", "2026-09-01T10:15:00", "linked"),
      block("academic", "2026-09-01T08:00:00", "2026-09-01T09:00:00", "academic"),
      block("task", "2026-09-01T10:10:00", "2026-09-01T10:40:00", "task"),
    ];
    const conflicts = findTimeConflicts(candidate, existing);
    expect(conflicts).toHaveLength(3);
    expect(conflicts.map(conflict => conflict.item.id)).toEqual(["personal", "linked", "task"]);
    expect(conflicts.map(conflict => conflict.overlapMinutes)).toEqual([30, 15, 30]);
  });

  it("does not flag an item against its own recurring occurrence", () => {
    const recurringOccurrence = block("routine:2026-09-01", "2026-09-01T10:00:00", "2026-09-01T11:00:00");
    const base = block("routine", "2026-09-01T10:00:00", "2026-09-01T11:00:00");
    expect(findTimeConflicts(base, [recurringOccurrence])).toEqual([]);
  });
});
