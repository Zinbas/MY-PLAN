import { describe, expect, it } from "vitest";
import { shouldOfferFirstVisit } from "./firstVisitFlow";

describe("first visit entry flow", () => {
  it("offers the decision only to a genuinely new signed-out visitor", () => {
    expect(shouldOfferFirstVisit({ isAuthenticated: false, hasCompletedEntry: false, hasPreviousWelcomeState: false })).toBe(true);
    expect(shouldOfferFirstVisit({ isAuthenticated: true, hasCompletedEntry: false, hasPreviousWelcomeState: false })).toBe(false);
    expect(shouldOfferFirstVisit({ isAuthenticated: false, hasCompletedEntry: true, hasPreviousWelcomeState: false })).toBe(false);
    expect(shouldOfferFirstVisit({ isAuthenticated: false, hasCompletedEntry: false, hasPreviousWelcomeState: true })).toBe(false);
  });

  it("does not show the welcome decision again after either explicit entry state is persisted", () => {
    expect(shouldOfferFirstVisit({ isAuthenticated: false, hasCompletedEntry: true, hasPreviousWelcomeState: true })).toBe(false);
  });
});
