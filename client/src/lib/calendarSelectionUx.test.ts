import { describe, expect, it } from "vitest";
import { calendarSelectionSummary } from "./calendarSelectionUx";

describe("calendar selection UX copy", () => {
  it("gives an actionable empty state and an accurate selected count", () => {
    expect(calendarSelectionSummary(0, 0)).toBe("No calendars available");
    expect(calendarSelectionSummary(0, 6)).toBe("Choose the calendars MY PLAN may show");
    expect(calendarSelectionSummary(1, 1)).toBe("1 of 1 calendar selected");
    expect(calendarSelectionSummary(2, 6)).toBe("2 of 6 calendars selected");
  });
});
