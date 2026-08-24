import { describe, expect, it } from "vitest";
import { shouldRefreshAfterExternalAuth } from "./externalAuthRefresh";

describe("external MY PLAN auth refresh", () => {
  it("refreshes only after an explicitly started external sign-in journey", () => {
    expect(shouldRefreshAfterExternalAuth("1")).toBe(true);
    expect(shouldRefreshAfterExternalAuth(null)).toBe(false);
    expect(shouldRefreshAfterExternalAuth("0")).toBe(false);
  });
});
