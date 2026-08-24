import { describe, expect, it } from "vitest";
import { calendarSelectionSaveMessage } from "./calendarSelectionFeedback";

describe("calendar selection feedback", () => {
  it("keeps a persisted selection distinct from a follow-up sync warning", () => {
    expect(calendarSelectionSaveMessage({ isVisible: true, syncStatus: "attention" })).toContain("selection saved");
    expect(calendarSelectionSaveMessage({ isVisible: true, syncStatus: "attention" })).toContain("sync needs attention");
  });

  it("keeps the regular confirmation for idle and healthy selection changes", () => {
    expect(calendarSelectionSaveMessage({ isVisible: false, syncStatus: "idle" })).toBe("Calendar selection saved. MY PLAN will only show and sync the calendars you selected.");
    expect(calendarSelectionSaveMessage({ isVisible: true, syncStatus: "healthy" })).toBe("Calendar selection saved. MY PLAN will only show and sync the calendars you selected.");
  });
});
