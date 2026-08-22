import { describe, expect, it } from "vitest";
import { dateForImportInput, dateFromImportInput, isValidImportDate } from "./importDates";

describe("import date validation", () => {
  it("accepts exact real YYYY-MM-DD calendar dates", () => {
    expect(isValidImportDate("2026-09-14")).toBe(true);
    expect(isValidImportDate("2024-02-29")).toBe(true);
  });

  it("rejects malformed and impossible manual dates", () => {
    expect(isValidImportDate("2026-9-14")).toBe(false);
    expect(isValidImportDate("14/09/2026")).toBe(false);
    expect(isValidImportDate("2026-02-29")).toBe(false);
    expect(isValidImportDate("2026-13-01")).toBe(false);
  });

  it("round-trips a picker selection using local YYYY-MM-DD text", () => {
    const picked = new Date(2026, 8, 14);
    expect(dateForImportInput(picked)).toBe("2026-09-14");
    expect(dateFromImportInput("2026-09-14")?.getFullYear()).toBe(2026);
    expect(dateFromImportInput("2026-09-14")?.getMonth()).toBe(8);
    expect(dateFromImportInput("2026-09-14")?.getDate()).toBe(14);
  });
});
