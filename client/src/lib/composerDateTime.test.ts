import { describe, expect, it } from "vitest";
import { readComposerDateTime } from "./composerDateTime";

describe("readComposerDateTime", () => {
  it("requires a real calendar date and supports an intentionally blank time", () => {
    expect(readComposerDateTime("", "")).toBeNull();
    expect(readComposerDateTime("words", "")).toBeNull();
    expect(readComposerDateTime("2026-02-30", "")).toBeNull();
    expect(readComposerDateTime("2026-08-25", "")).toEqual(new Date(2026, 7, 25, 9));
  });

  it("accepts a valid chosen time and rejects malformed time text", () => {
    expect(readComposerDateTime("2026-08-25", "14:30")).toEqual(new Date(2026, 7, 25, 14, 30));
    expect(readComposerDateTime("2026-08-25", "letters")).toBeNull();
  });
});
