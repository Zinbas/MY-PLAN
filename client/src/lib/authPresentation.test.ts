import { describe, expect, it } from "vitest";
import { shouldBlockAuthPresentation, visiblePrivateData } from "./authPresentation";

describe("MY PLAN auth presentation", () => {
  it("does not keep the app in a blocking state while logout confirmation finishes", () => {
    expect(shouldBlockAuthPresentation(true)).toBe(true);
    expect(shouldBlockAuthPresentation(false)).toBe(false);
  });

  it("never renders cached private data in the signed-out shell", () => {
    expect(visiblePrivateData(false, ["private connection"])).toEqual([]);
    expect(visiblePrivateData(true, ["private connection"])).toEqual(["private connection"]);
  });
});
