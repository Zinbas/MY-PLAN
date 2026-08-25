import { describe, expect, it } from "vitest";
import { personalReminderCandidates } from "./personalReminderEnrollment";

describe("personal reminder enrollment", () => {
  const now = new Date("2026-08-25T09:00:00.000Z");

  it("creates upcoming reminder candidates without exporting notes, course names, or checklists", () => {
    const candidates = personalReminderCandidates({
      now,
      tasks: [{ id: "task-1", title: "Submit essay", dueAt: new Date("2026-08-26T09:00:00.000Z"), priority: "high", course: "History", notes: "Private draft note", completed: false }],
      events: [{ id: "event-1", title: "Study group", startAt: new Date("2026-08-27T10:00:00.000Z"), endAt: new Date("2026-08-27T11:00:00.000Z"), priority: "normal", course: "Biology", notes: "Private location" }],
      blocks: [{ id: "block-1", title: "Deep work", startAt: new Date("2026-08-28T10:00:00.000Z"), endAt: new Date("2026-08-28T11:00:00.000Z"), source: "planner", notes: "Private focus note", checklist: [{ id: "one", label: "Private checklist item", done: false }] }],
    });

    expect(candidates.map(candidate => [candidate.sourceKind, candidate.title, candidate.body])).toEqual([
      ["task", "Submit essay", "Task due"],
      ["event", "Study group", "Personal event starts"],
      ["block", "Deep work", "Focus block starts"],
    ]);
    expect(JSON.stringify(candidates)).not.toContain("Private");
    expect(JSON.stringify(candidates)).not.toContain("History");
  });

  it("keeps an explicit contextual lead while still excluding private item details", () => {
    const candidates = personalReminderCandidates({
      now,
      tasks: [{ id: "task-lead", title: "Send draft", dueAt: new Date("2026-08-26T12:00:00.000Z"), priority: "normal", course: "Private course", notes: "Private note", completed: false, reminderLeadMinutes: 10 }],
      events: [],
      blocks: [],
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ leadMinutes: 10, title: "Send draft" });
    expect(JSON.stringify(candidates)).not.toContain("Private");
  });

  it("skips completed, past, and out-of-horizon planning items", () => {
    const candidates = personalReminderCandidates({
      now,
      horizonDays: 2,
      tasks: [
        { id: "done", title: "Done", dueAt: new Date("2026-08-26T09:00:00.000Z"), priority: "normal", course: "", notes: "", completed: true },
        { id: "past", title: "Past", dueAt: new Date("2026-08-24T09:00:00.000Z"), priority: "normal", course: "", notes: "", completed: false },
        { id: "later", title: "Later", dueAt: new Date("2026-08-30T09:00:00.000Z"), priority: "normal", course: "", notes: "", completed: false },
      ],
      events: [],
      blocks: [],
    });
    expect(candidates).toEqual([]);
  });
});
