import { describe, expect, it } from "vitest";

describe("managed MY PLAN title", () => {
  it("uses the MY PLAN deployment title", () => {
    expect(process.env.VITE_APP_TITLE).toBe("MY PLAN");
  });
});
