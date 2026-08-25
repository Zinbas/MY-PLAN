export function syncCalendarStatus(isAuthenticated: boolean, googleOAuthReady?: boolean) {
  if (!isAuthenticated) return "Sign in to connect";
  return googleOAuthReady ? "Ready to import" : "Setup in progress";
}
