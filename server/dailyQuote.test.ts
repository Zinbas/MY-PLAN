import { describe, expect, it } from "vitest";
import { dailyQuoteForDate } from "../client/src/lib/dailyQuote";

describe("dailyQuoteForDate", () => {
  it("remains stable for repeated reads of the same local day", () => {
    const morning = new Date(2032, 4, 11, 8, 15);
    const evening = new Date(2032, 4, 11, 22, 45);
    expect(dailyQuoteForDate(morning)).toBe(dailyQuoteForDate(evening));
  });

  it("rotates to a different quote on the following day", () => {
    const firstDay = new Date(2032, 4, 11, 12);
    const nextDay = new Date(2032, 4, 12, 12);
    expect(dailyQuoteForDate(firstDay)).not.toBe(dailyQuoteForDate(nextDay));
  });
});
