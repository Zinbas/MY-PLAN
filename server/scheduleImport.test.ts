import { describe, expect, it } from "vitest";
import { csvRows, icsCandidates, rowCandidates } from "./scheduleImport";

describe("schedule import parsers", () => {
  it("extracts event candidates from an ICS calendar without invoking a model", () => {
    const candidates = icsCandidates(`BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:Calculus Quiz\nDTSTART:20260911T103000\nDTEND:20260911T113000\nDESCRIPTION:Unit II review\nEND:VEVENT\nEND:VCALENDAR`);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ title: "Calculus Quiz", kind: "event", date: "2026-09-11", time: "10:30", durationMinutes: 60, confidence: 0.99 });
  });

  it("maps spreadsheet-style schedule columns into editable task candidates", () => {
    const rows = csvRows("Task,Due Date,Time,Course,Duration\nSubmit lab record,2026-08-12,17:00,Java,45");
    const candidates = rowCandidates(rows);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ title: "Submit lab record", kind: "event", date: "2026-08-12", time: "17:00", course: "Java", durationMinutes: 45, confidence: 0.94 });
  });

  it("leaves ambiguous spreadsheet dates blank for user review instead of inventing one", () => {
    const candidates = rowCandidates(csvRows("Title,Course\nPrepare project summary,Data Structures"));
    expect(candidates[0]).toMatchObject({ title: "Prepare project summary", date: "", confidence: 0.62 });
  });
});
