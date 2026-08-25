import { describe, expect, it } from "vitest";
import { assistantCommandDraftSchema, assistantDraftCanOpenComposer, isAssistantDate } from "@shared/assistantDraft";

describe("MY PLAN Assistant draft safeguards", () => {
  it("accepts only real calendar dates", () => {
    expect(isAssistantDate("2026-09-14")).toBe(true);
    expect(isAssistantDate("2026-02-30")).toBe(false);
    expect(isAssistantDate("tomorrow")).toBe(false);
  });

  it("allows a date-only task with no time or reminder", () => {
    const draft = assistantCommandDraftSchema.parse({
      kind: "task", title: "Finish DSA worksheet", date: "2026-09-14", time: null, durationMinutes: null,
      priority: "normal", course: null, notes: null, reminderLeadMinutes: null, needsClarification: false, clarification: null,
    });
    expect(assistantDraftCanOpenComposer(draft)).toBe(true);
  });

  it("prevents a vague request from opening the composer before clarification", () => {
    const draft = assistantCommandDraftSchema.parse({
      kind: "event", title: "Revision", date: null, time: null, durationMinutes: null,
      priority: "normal", course: null, notes: null, reminderLeadMinutes: null, needsClarification: true, clarification: "Which date should I use for revision?",
    });
    expect(assistantDraftCanOpenComposer(draft)).toBe(false);
  });
});
