import { describe, expect, it } from "vitest";
import { syncCalendarStatus } from "./syncStatus";

describe("syncCalendarStatus", () => {
  it("does not show import readiness before a visitor can sign in and connect an account", () => {
    expect(syncCalendarStatus(false, true)).toBe("Sign in to connect");
  });

  it("distinguishes signed-in OAuth readiness from setup still in progress", () => {
    expect(syncCalendarStatus(true, true)).toBe("Ready to import");
    expect(syncCalendarStatus(true, false)).toBe("Setup in progress");
  });
});
