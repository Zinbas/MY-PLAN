/**
 * Google Calendar activation layer. It is intentionally configuration-gated so the application
 * can run in demo mode without ever pretending that a Google account is connected.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "crypto";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const CALENDAR_LIST_SCOPE = "https://www.googleapis.com/auth/calendar.calendarlist.readonly";
const IDENTITY_SCOPES = ["openid", "email", "profile"];

export type GoogleOAuthConfig = {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
};

export function getGoogleOAuthConfig(): GoogleOAuthConfig {
  return {
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI,
  };
}

export function isGoogleOAuthConfigured(config = getGoogleOAuthConfig()) {
  return Boolean(config.clientId && config.clientSecret && config.redirectUri);
}

export function googleOAuthReadiness(config = getGoogleOAuthConfig()) {
  const ready = isGoogleOAuthConfigured(config);
  return {
    ready,
    mode: ready ? "live" as const : "setup-pending" as const,
    message: ready
      ? "Google Calendar is ready to connect after MY PLAN sign-in."
      : "Google Calendar setup is pending the owner’s OAuth credentials. You can keep planning locally in MY PLAN.",
  };
}

export function buildGoogleAuthorizationUrl(config: Required<GoogleOAuthConfig>, state: string) {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", [...IDENTITY_SCOPES, CALENDAR_SCOPE, CALENDAR_LIST_SCOPE].join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}

export function createConnectionState(userId?: number) {
  return `${userId ?? "public"}.${randomUUID()}`;
}

export function hashOAuthState(state: string) {
  return createHash("sha256").update(state).digest("hex");
}

export function encryptGoogleCredential(value: string, keyMaterial = process.env.JWT_SECRET) {
  if (!keyMaterial) throw new Error("JWT_SECRET is required to protect Google credentials");
  const key = createHash("sha256").update(keyMaterial).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptGoogleCredential(payload: string, keyMaterial = process.env.JWT_SECRET) {
  if (!keyMaterial) throw new Error("JWT_SECRET is required to protect Google credentials");
  const [ivValue, tagValue, encryptedValue] = payload.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Invalid encrypted credential payload");
  const key = createHash("sha256").update(keyMaterial).digest();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8");
}

export type GoogleTokenResponse = { access_token: string; refresh_token?: string; scope?: string; token_type: string; expires_in: number };
export type GoogleProfile = { sub: string; email: string; name?: string; hd?: string };

export async function exchangeGoogleAuthorizationCode(config: Required<GoogleOAuthConfig>, code: string): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({ code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri, grant_type: "authorization_code" });
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!response.ok) throw new Error(`Google token exchange failed with ${response.status}`);
  return response.json() as Promise<GoogleTokenResponse>;
}

export async function getGoogleProfile(accessToken: string): Promise<GoogleProfile> {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(`Google profile request failed with ${response.status}`);
  return response.json() as Promise<GoogleProfile>;
}

export const googleActivationChecklist = [
  "Create a Google Cloud project owned by the app owner.",
  "Enable the Google Calendar API.",
  "Configure the OAuth consent screen and add test users while the app is in testing.",
  "Create a Web application OAuth client and add the application callback URL.",
  "Set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and GOOGLE_OAUTH_REDIRECT_URI in the project settings.",
] as const;

export function googleOAuthSetupPendingResponse() {
  return {
    code: "GOOGLE_OAUTH_NOT_CONFIGURED",
    message: "Google Calendar activation requires the app owner's Google OAuth credentials.",
    checklist: googleActivationChecklist,
  } as const;
}
