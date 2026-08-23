import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { csvRows, deduplicateTimetableCandidates, icsCandidates, rowCandidates, workbookCandidates } from "./scheduleImport";

describe("schedule import parsers", () => {
  it("extracts event candidates from an ICS calendar without invoking a model", () => {
    const candidates = icsCandidates(`BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:Calculus Quiz\nDTSTART:20260911T103000\nDTEND:20260911T113000\nDESCRIPTION:Unit II review\nEND:VEVENT\nEND:VCALENDAR`);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ title: "Calculus Quiz", kind: "event", date: "2026-09-11", time: "10:30", durationMinutes: 60, weekdays: [], confidence: 0.99 });
  });

  it("maps spreadsheet-style schedule columns into editable task candidates", () => {
    const rows = csvRows("Task,Due Date,Time,Course,Duration\nSubmit lab record,2026-08-12,17:00,Java,45");
    const candidates = rowCandidates(rows);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ title: "Submit lab record", kind: "event", date: "2026-08-12", time: "17:00", course: "Java", durationMinutes: 45, weekdays: [], confidence: 0.94 });
  });

  it("reads an XLSX workbook into editable candidates without sending spreadsheet data to the model", async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ["Task", "Due Date", "Time", "Course", "Duration", "Type"],
      ["Revise integration methods", "2026-09-14", "18:30", "Calculus", 75, "study block"],
    ]), "Routine");
    const candidates = await workbookCandidates(Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })));
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ title: "Revise integration methods", kind: "block", date: "2026-09-14", time: "18:30", course: "Calculus", durationMinutes: 75, confidence: 0.94 });
  });

  it("leaves ambiguous spreadsheet dates blank for user review instead of inventing one", () => {
    const candidates = rowCandidates(csvRows("Title,Course\nPrepare project summary,Data Structures"));
    expect(candidates[0]).toMatchObject({ title: "Prepare project summary", date: "", confidence: 0.62 });
  });

  it("keeps one internally consistent candidate per weekly timetable day-and-time cell", () => {
    const candidates = deduplicateTimetableCandidates([
      { id: "wrong", title: "Probability and Statistics", kind: "block", date: "", time: "01:00", durationMinutes: 60, course: "Financial Literacy", notes: "", weekdays: [1], confidence: 1 },
      { id: "right", title: "Probability and Statistics", kind: "block", date: "", time: "01:00", durationMinutes: 60, course: "Probability and Statistics", notes: "", weekdays: [1], confidence: 0.8 },
      { id: "other-slot", title: "Probability and Statistics", kind: "block", date: "", time: "01:00", durationMinutes: 60, course: "Probability and Statistics", notes: "", weekdays: [2], confidence: 0.8 },
    ]);
    expect(candidates).toHaveLength(2);
    expect(candidates.find(candidate => candidate.weekdays[0] === 1)?.id).toBe("right");
    expect(candidates.find(candidate => candidate.weekdays[0] === 2)?.id).toBe("other-slot");
    expect(candidates.every(candidate => candidate.course === candidate.title)).toBe(true);
  });

  it("splits an ambiguous multi-day timetable suggestion into one candidate for each reviewable day cell", () => {
    const candidates = deduplicateTimetableCandidates([
      { id: "combined", title: "Data Structures", kind: "block", date: "", time: "10:00", durationMinutes: 60, course: "Data Structures", notes: "", weekdays: [1, 3, 3], confidence: 0.8 },
    ]);
    expect(candidates).toHaveLength(2);
    expect(candidates.map(candidate => candidate.weekdays)).toEqual([[1], [3]]);
  });
});
