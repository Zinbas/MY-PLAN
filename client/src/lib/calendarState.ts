/** Presentation state for linked Google Calendar events, kept pure for deterministic testing. */
export type LinkedEventDisplayState = "hidden" | "loading" | "empty" | "error" | "ready";

export function getLinkedEventDisplayState(input: { authenticated: boolean; loading: boolean; error: boolean; count: number | undefined }): LinkedEventDisplayState {
  if (!input.authenticated) return "hidden";
  if (input.loading) return "loading";
  if (input.error) return "error";
  if (input.count === 0) return "empty";
  return "ready";
}
