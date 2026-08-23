import { describe, expect, it } from "vitest";
import { mapSelectedImportCandidates } from "./importSelection";

const candidates = [
  { id: "event", title: "Timed exam", kind: "event" as const, date: "2026-09-14", time: "10:15", durationMinutes: 90, course: "Math", notes: "Room 201" },
  { id: "task", title: "Date-only task", kind: "task" as const, date: "2026-09-15", time: "", durationMinutes: 60, course: "", notes: "" },
  { id: "blocked", title: "Invalid date", kind: "event" as const, date: "2026-02-30", time: "09:00", durationMinutes: 60, course: "", notes: "" },
  { id: "weekly", title: "Java Programming Lab", kind: "event" as const, date: "2026-09-01", time: "14:00", durationMinutes: 60, course: "Java", notes: "B401", weekdays: [2] },
];

describe("selected import mapping", () => {
  it("maps only candidates with valid dates to private item records", () => {
    const mapped = mapSelectedImportCandidates(candidates, 1_700_000_000_000);
    expect(mapped.ready).toHaveLength(3);
    expect(mapped.skipped).toBe(1);
    expect(mapped.events).toHaveLength(1);
    expect(mapped.tasks).toHaveLength(1);
    expect(mapped.blocks).toHaveLength(1);
    expect(mapped.events[0].startAt.toISOString()).toContain("2026-09-14T10:15");
  });

  it("defaults an empty time to 9:00 AM without scheduling a date-only task", () => {
    const mapped = mapSelectedImportCandidates(candidates, 1_700_000_000_000);
    expect(mapped.tasks[0].dueAt.getHours()).toBe(9);
    expect(mapped.tasks[0].scheduledStartAt).toBeNull();
  });

  it("converts a weekly timetable class into a recurring block on its extracted weekday", () => {
    const mapped = mapSelectedImportCandidates(candidates, 1_700_000_000_000, "2026-12-18");
    expect(mapped.blocks[0].repeat).toBe("weekly");
    expect(mapped.blocks[0].startAt.getDay()).toBe(2);
    expect(mapped.blocks[0].startAt.getHours()).toBe(14);
    expect(mapped.blocks[0].repeatUntil?.toISOString()).toContain("2026-12-18T23:59");
  });

  it("maps every approved weekly timetable candidate in a large selection", () => {
    const weeklyCandidates = Array.from({ length: 30 }, (_, index) => ({ id: `weekly-${index}`, title: `Routine ${index + 1}`, kind: "block" as const, date: "2026-08-22", time: `${String(8 + (index % 8)).padStart(2, "0")}:00`, durationMinutes: 60, course: "Routine", notes: "", weekdays: [index % 7] }));
    const mapped = mapSelectedImportCandidates(weeklyCandidates, 1_700_000_000_000, "2026-12-18");
    expect(mapped.ready).toHaveLength(30);
    expect(mapped.blocks).toHaveLength(30);
    expect(mapped.blocks.every(block => block.repeat === "weekly" && block.repeatUntil?.toISOString().includes("2026-12-18T23:59"))).toBe(true);
  });
});
