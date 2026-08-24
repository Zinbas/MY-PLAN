import { describe, expect, it } from "vitest";
import { accountStatusCopy } from "./accountStatusCopy";

describe("account status copy", () => {
  it("shows a clear active-account confirmation when signed in", () => {
    expect(accountStatusCopy(true)).toBe("Your MY PLAN account is active. Connected services stay private to you.");
  });

  it("keeps local-first guidance for signed-out visitors", () => {
    expect(accountStatusCopy(false)).toContain("Plan locally first");
  });
});
