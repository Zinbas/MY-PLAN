import { describe, expect, it } from "vitest";
import { shouldBlockAuthPresentation } from "./authPresentation";

describe("MY PLAN auth presentation", () => {
  it("does not keep the app in a blocking state while logout confirmation finishes", () => {
    expect(shouldBlockAuthPresentation(true)).toBe(true);
    expect(shouldBlockAuthPresentation(false)).toBe(false);
  });
});
