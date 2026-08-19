import { describe, expect, it } from "vitest";
import { getLinkedEventDisplayState } from "./calendarState";

describe("linked Google event display state", () => {
  it("shows an explicit empty state only for an authenticated, settled empty linked-calendar query", () => {
    expect(getLinkedEventDisplayState({ authenticated: true, loading: false, error: false, count: 0 })).toBe("empty");
    expect(getLinkedEventDisplayState({ authenticated: true, loading: true, error: false, count: 0 })).toBe("loading");
    expect(getLinkedEventDisplayState({ authenticated: false, loading: false, error: false, count: 0 })).toBe("hidden");
  });

  it("keeps the ready state for existing linked events without affecting the academic or demo item sources", () => {
    expect(getLinkedEventDisplayState({ authenticated: true, loading: false, error: false, count: 3 })).toBe("ready");
  });
});
