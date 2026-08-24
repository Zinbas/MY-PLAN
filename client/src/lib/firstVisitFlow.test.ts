import { describe, expect, it } from "vitest";
import { shouldOfferFirstVisit } from "./firstVisitFlow";

describe("first visit entry flow", () => {
  it("offers the decision only to a genuinely new signed-out visitor", () => {
    expect(shouldOfferFirstVisit({ isAuthenticated: false, hasCompletedEntry: false, hasPreviousWelcomeState: false })).toBe(true);
    expect(shouldOfferFirstVisit({ isAuthenticated: true, hasCompletedEntry: false, hasPreviousWelcomeState: false })).toBe(false);
    expect(shouldOfferFirstVisit({ isAuthenticated: false, hasCompletedEntry: true, hasPreviousWelcomeState: false })).toBe(false);
    expect(shouldOfferFirstVisit({ isAuthenticated: false, hasCompletedEntry: false, hasPreviousWelcomeState: true })).toBe(false);
  });
});
