import { describe, expect, it } from "vitest";
import { applyOptimisticCalendarSelection } from "./calendarSelectionOptimistic";

describe("optimistic connected-calendar selection", () => {
  it("updates only the clicked calendar while retaining all other private selections", () => {
    const original = [{ id: 1, calendars: [{ id: 11, isVisible: true }, { id: 12, isVisible: false }] }, { id: 2, calendars: [{ id: 21, isVisible: true }] }];
    const updated = applyOptimisticCalendarSelection(original, 12, true);
    expect(updated).toEqual([{ id: 1, calendars: [{ id: 11, isVisible: true }, { id: 12, isVisible: true }] }, { id: 2, calendars: [{ id: 21, isVisible: true }] }]);
    expect(original[0].calendars[1].isVisible).toBe(false);
  });

  it("preserves an undefined cache while a connection query has not loaded", () => {
    expect(applyOptimisticCalendarSelection(undefined, 12, true)).toBeUndefined();
  });

  it("keeps a later selection intent deterministic when applied after the current optimistic state", () => {
    const original = [{ id: 1, calendars: [{ id: 11, isVisible: false }] }];
    const selected = applyOptimisticCalendarSelection(original, 11, true);
    const restored = applyOptimisticCalendarSelection(selected, 11, false);
    expect(selected?.[0].calendars[0].isVisible).toBe(true);
    expect(restored?.[0].calendars[0].isVisible).toBe(false);
    expect(original[0].calendars[0].isVisible).toBe(false);
  });
});
