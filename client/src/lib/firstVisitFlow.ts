export type FirstVisitChoice = "guest" | "sign-in";
export type FirstVisitStage = "hidden" | "choice" | "tutorial";

export function shouldOfferFirstVisit({ isAuthenticated, hasCompletedEntry, hasPreviousWelcomeState }: {
  isAuthenticated: boolean;
  hasCompletedEntry: boolean;
  hasPreviousWelcomeState: boolean;
}) {
  return !isAuthenticated && !hasCompletedEntry && !hasPreviousWelcomeState;
}
