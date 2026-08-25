import { describe, expect, it } from "vitest";
import { dueInAppReminder, inAppReminderCandidates, type InAppReminderState } from "./inAppReminders";
import type { PlannerBlock } from "./ongoingCalendar";

const block = (overrides: Partial<PlannerBlock> = {}): PlannerBlock => ({ id: "block-1", title: "Physics revision", startAt: new Date("2026-08-26T19:00:00"), endAt: new Date("2026-08-26T20:00:00"), source: "planner", priority: "normal", completed: false, hasTime: true, reminderLeadMinutes: 5, ...overrides });
const emptyState: InAppReminderState = { dismissedIds: [], snoozedUntil: {} };

describe("in-app due reminders", () => {
  it("creates a timed reminder candidate at the requested lead time", () => {
    const [candidate] = inAppReminderCandidates([block()]);
    expect(candidate.reminderAt.toISOString()).toBe("2026-08-26T18:55:00.000Z");
  });

  it("excludes date-only plans from sound or popup delivery", () => {
    expect(inAppReminderCandidates([block({ hasTime: false })])).toEqual([]);
  });

  it("returns a due candidate, respects dismissal, and re-shows a due snooze", () => {
    const [candidate] = inAppReminderCandidates([block()]);
    expect(dueInAppReminder([candidate], emptyState, new Date("2026-08-26T18:55:30"))?.id).toBe(candidate.id);
    expect(dueInAppReminder([candidate], { dismissedIds: [candidate.id], snoozedUntil: {} }, new Date("2026-08-26T18:55:30"))).toBeNull();
    expect(dueInAppReminder([candidate], { dismissedIds: [], snoozedUntil: { [candidate.id]: Date.parse("2026-08-26T19:00:30") } }, new Date("2026-08-26T18:56:00"))).toBeNull();
    expect(dueInAppReminder([candidate], { dismissedIds: [], snoozedUntil: { [candidate.id]: Date.parse("2026-08-26T19:00:30") } }, new Date("2026-08-26T19:00:30"))?.id).toBe(candidate.id);
    expect(dueInAppReminder([candidate], { dismissedIds: [], snoozedUntil: { [candidate.id]: Date.parse("2026-08-26T19:00:30") } }, new Date("2026-08-26T19:02:01"))).toBeNull();
  });
});
