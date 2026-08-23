import { describe, expect, it } from "vitest";
import { conflictCountsFor, excludeRecurringDate, expandRepeatingBlock, findTimeConflicts, type PlannerBlock } from "./ongoingCalendar";

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

  it("precomputes overlap counts once for every calendar item", () => {
    const first = block("first", "2026-09-01T10:00:00", "2026-09-01T11:00:00");
    const second = block("second", "2026-09-01T10:30:00", "2026-09-01T11:30:00");
    const separate = block("separate", "2026-09-01T12:00:00", "2026-09-01T13:00:00");
    expect(Array.from(conflictCountsFor([first, second, separate]).entries())).toEqual([["first", 1], ["second", 1], ["separate", 0]]);
  });
});

describe("recurring routine exceptions", () => {
  it("omits only the selected excluded date and retains the rest of a weekly series", () => {
    const recurring: PlannerBlock = { id: "tutorial", title: "Tutorial/Remedial", startAt: new Date("2026-08-22T14:00:00"), endAt: new Date("2026-08-22T15:00:00"), source: "planner", repeat: "weekly", repeatUntil: new Date("2026-09-12T23:59:00"), excludedDates: ["2026-08-29"] };
    const expanded = expandRepeatingBlock(recurring, new Date("2026-08-20"), new Date("2026-09-20"));
    expect(expanded.map(block => block.startAt.toISOString().slice(0, 10))).toEqual(["2026-08-22", "2026-09-05", "2026-09-12"]);
  });

  it("records a selected recurring date once even if the action is repeated", () => {
    const recurring = block("tutorial", "2026-08-22T14:00:00", "2026-08-22T15:00:00");
    const once = excludeRecurringDate(recurring, new Date("2026-08-29T14:00:00"));
    const twice = excludeRecurringDate(once, new Date("2026-08-29T14:00:00"));
    expect(twice.excludedDates).toEqual(["2026-08-29"]);
  });
});
