import { SecureStorage } from "@aparajita/capacitor-secure-storage";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { isNativeAndroidMyPlanApp, MY_PLAN_PUBLIC_ORIGIN } from "./capacitorRuntime";

const SESSION_KEY = "my-plan.native-session.v1";
const VERIFIER_KEY = "my-plan.native-oauth-verifier.v1";
const codePattern = /^[A-Za-z0-9_-]{43,128}$/;
type StoredNativeSession = { token: string; expiresAt: string };

function randomVerifier() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function readNativeSessionToken() {
  if (!isNativeAndroidMyPlanApp()) return null;
  const stored = await SecureStorage.get(SESSION_KEY) as StoredNativeSession | null;
  if (!stored?.token || !stored.expiresAt || new Date(stored.expiresAt) <= new Date()) {
    if (stored) await SecureStorage.remove(SESSION_KEY);
    return null;
  }
  return stored.token;
}

export async function clearNativeSession() {
  if (!isNativeAndroidMyPlanApp()) return;
  await Promise.all([SecureStorage.remove(SESSION_KEY), SecureStorage.remove(VERIFIER_KEY)]);
}

export async function startNativeLogin() {
  if (!isNativeAndroidMyPlanApp()) return false;
  const verifier = randomVerifier();
  await SecureStorage.set(VERIFIER_KEY, verifier);
  const verifierHash = await sha256Hex(verifier);
  await Browser.open({ url: `${MY_PLAN_PUBLIC_ORIGIN}/api/mobile/oauth/start?verifierHash=${verifierHash}` });
  return true;
}

async function exchangeNativeAuthCode(code: string) {
  if (!isNativeAndroidMyPlanApp() || !codePattern.test(code)) return null;
  const verifier = await SecureStorage.get(VERIFIER_KEY) as string | null;
  if (!verifier) return null;
  const response = await fetch(`${MY_PLAN_PUBLIC_ORIGIN}/api/mobile/oauth/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "omit",
    body: JSON.stringify({ code, verifier }),
  });
  if (!response.ok) throw new Error("MY PLAN could not complete the secure mobile sign-in.");
  const payload = await response.json() as StoredNativeSession;
  if (!payload.token || !payload.expiresAt) throw new Error("MY PLAN received an incomplete mobile session.");
  await SecureStorage.set(SESSION_KEY, payload);
  await SecureStorage.remove(VERIFIER_KEY);
  await Browser.close().catch(() => undefined);
  return payload.token;
}

export async function initializeNativeSessionHandoff(onToken: (token: string) => void) {
  if (!isNativeAndroidMyPlanApp()) return;
  const handleUrl = async (candidate: string) => {
    try {
      const url = new URL(candidate);
      if (url.origin !== MY_PLAN_PUBLIC_ORIGIN) return;
      const code = url.searchParams.get("native_auth_code");
      if (!code) return;
      const token = await exchangeNativeAuthCode(code);
      if (token) onToken(token);
    } catch {
      // Untrusted or malformed deep links are ignored.
    }
  };
  await App.addListener("appUrlOpen", event => void handleUrl(event.url));
  const launch = await App.getLaunchUrl();
  if (launch?.url) await handleUrl(launch.url);
}
