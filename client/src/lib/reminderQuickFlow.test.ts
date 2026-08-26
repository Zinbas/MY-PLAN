import { describe, expect, it } from "vitest";
import { initialReminderLeadForComposer, QUICK_REMINDER_LEAD_MINUTES } from "./reminderQuickFlow";

describe("MY PLAN quick reminder flow", () => {
  it("preselects a calm 10-minute lead only when a user explicitly chooses Set reminder", () => {
    expect(initialReminderLeadForComposer(true)).toBe(QUICK_REMINDER_LEAD_MINUTES);
    expect(initialReminderLeadForComposer(true)).toBe(10);
    expect(initialReminderLeadForComposer(false)).toBe("");
  });
});
