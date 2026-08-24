import { describe, expect, it } from "vitest";
import { accountAccessLabel } from "./accountAccessUx";

describe("MY PLAN account access copy", () => {
  it("uses an explicit sign-in label and a concise signed-in account label", () => {
    expect(accountAccessLabel(false)).toBe("Sign in to MY PLAN");
    expect(accountAccessLabel(true, "Ava")).toBe("Account: Ava");
    expect(accountAccessLabel(true)).toBe("MY PLAN account");
  });
});
