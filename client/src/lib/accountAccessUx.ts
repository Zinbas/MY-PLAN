export function accountAccessLabel(isAuthenticated: boolean, name?: string | null) {
  if (!isAuthenticated) return "Sign in to MY PLAN";
  return name ? `Account: ${name}` : "MY PLAN account";
}
