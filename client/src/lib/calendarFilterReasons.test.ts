import { describe, expect, it } from "vitest";
import { calendarFilterReasons } from "./calendarFilterReasons";
import type { PlannerBlock } from "./ongoingCalendar";

const event: PlannerBlock = { id: "block", title: "Revision", startAt: new Date("2026-08-23T10:00:00"), endAt: new Date("2026-08-23T11:00:00"), source: "planner", priority: "high", repeat: "weekly" };
const noFilters = { source: "all", itemType: "all", scheduleHealth: "all", priority: "all", routine: "all", taskStatus: "all", course: "All courses / lists" } as const;

describe("calendar filter reasons", () => {
  it("explains every active filter that keeps a planner item visible", () => {
    expect(calendarFilterReasons(event, { ...noFilters, source: "planner", scheduleHealth: "conflicts", priority: "high", routine: "recurring", course: "Calculus" }, 1)).toEqual(["Focus block", "Has overlap", "High priority", "Recurring", "Calculus"]);
  });

  it("does not emit indicators when the calendar is unfiltered", () => {
    expect(calendarFilterReasons(event, noFilters, 0)).toEqual([]);
  });
});
