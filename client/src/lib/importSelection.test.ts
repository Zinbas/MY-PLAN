import { describe, expect, it } from "vitest";
import { mapSelectedImportCandidates } from "./importSelection";

const candidates = [
  { id: "event", title: "Timed exam", kind: "event" as const, date: "2026-09-14", time: "10:15", durationMinutes: 90, course: "Math", notes: "Room 201" },
  { id: "task", title: "Date-only task", kind: "task" as const, date: "2026-09-15", time: "", durationMinutes: 60, course: "", notes: "" },
  { id: "blocked", title: "Invalid date", kind: "event" as const, date: "2026-02-30", time: "09:00", durationMinutes: 60, course: "", notes: "" },
];

describe("selected import mapping", () => {
  it("maps only candidates with valid dates to private item records", () => {
    const mapped = mapSelectedImportCandidates(candidates, 1_700_000_000_000);
    expect(mapped.ready).toHaveLength(2);
    expect(mapped.skipped).toBe(1);
    expect(mapped.events).toHaveLength(1);
    expect(mapped.tasks).toHaveLength(1);
    expect(mapped.events[0].startAt.toISOString()).toContain("2026-09-14T10:15");
  });

  it("defaults an empty time to 9:00 AM without scheduling a date-only task", () => {
    const mapped = mapSelectedImportCandidates(candidates, 1_700_000_000_000);
    expect(mapped.tasks[0].dueAt.getHours()).toBe(9);
    expect(mapped.tasks[0].scheduledStartAt).toBeNull();
  });
});
