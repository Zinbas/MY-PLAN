import { describe, expect, it } from "vitest";
import { addMonths, daysInMonth, startOfWeek } from "../client/src/lib/ongoingCalendar";

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
});
