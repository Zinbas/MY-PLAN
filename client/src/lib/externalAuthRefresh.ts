export const EXTERNAL_AUTH_PENDING_KEY = "my-plan-external-auth-pending";

export function shouldRefreshAfterExternalAuth(value: string | null) {
  return value === "1";
}
