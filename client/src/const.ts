import { OAUTH_STATE_COOKIE, encodeOAuthState } from "@shared/const";
import { EXTERNAL_AUTH_PENDING_KEY } from "@/lib/externalAuthRefresh";
import { isNativeAndroidMyPlanApp } from "@/lib/capacitorRuntime";
import { startNativeLogin } from "@/lib/nativeSession";

export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Start the Manus OAuth login. Call this from an event handler or effect at the
// moment you want to navigate, e.g. `onClick={() => startLogin()}`.
//
// It has SIDE EFFECTS — it mints a one-time nonce, writes the __Host- state
// cookie, and navigates immediately — so the cookie nonce always matches the
// `state` it sends. Do NOT call it during render (no `href={startLogin()}` /
// `loginUrl={...}`): each call overwrites the cookie, so a stray render-phase
// call would desync it from an in-flight login and the callback would reject it
// with "invalid oauth state". It returns void by design, so there is no URL to
// stash across renders.
export const startLogin = () => {
  if (isNativeAndroidMyPlanApp()) {
    void startNativeLogin();
    return;
  }
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;

  const nonce = crypto.randomUUID();
  document.cookie = `${OAUTH_STATE_COOKIE}=${nonce}; Path=/; Max-Age=600; SameSite=Lax; Secure`;
  const state = encodeOAuthState({ redirectUri, nonce });

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  // Keep the planner available while the external provider handles sign-in.
  // This is the previously validated flow for embedded and browser-operator
  // contexts where navigating the current tab can strand users at about:blank.
  try {
    sessionStorage.setItem(EXTERNAL_AUTH_PENDING_KEY, "1");
  } catch {}
  const opened = window.open(url.toString(), "_blank", "noopener,noreferrer");
  if (!opened) window.location.assign(url.toString());
};
