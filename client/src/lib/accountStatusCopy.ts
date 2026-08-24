export function accountStatusCopy(isAuthenticated: boolean) {
  return isAuthenticated
    ? "Your MY PLAN account is active. Connected services stay private to you."
    : "Plan locally first. Sign in only when you want a MY PLAN account or connected services.";
}
