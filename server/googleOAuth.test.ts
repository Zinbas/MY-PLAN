import { describe, expect, it } from "vitest";
import { buildGoogleAuthorizationUrl, decryptGoogleCredential, encryptGoogleCredential, hashOAuthState, isGoogleOAuthConfigured } from "./googleOAuth";

describe("Google OAuth preparation", () => {
  it("builds an authorization request with identity and minimal calendar scopes", () => {
    const url = new URL(buildGoogleAuthorizationUrl({
      clientId: "client-id",
      clientSecret: "client-secret",
      redirectUri: "https://calendar.example.com/api/google/callback",
    }, "safe-state"));

    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("client-id");
    expect(url.searchParams.get("redirect_uri")).toBe("https://calendar.example.com/api/google/callback");
    expect(url.searchParams.get("scope")).toContain("https://www.googleapis.com/auth/calendar.events");
    expect(url.searchParams.get("scope")).toContain("openid");
    expect(url.searchParams.get("state")).toBe("safe-state");
  });

  it("only reports live readiness when all server-only OAuth values are present", () => {
    expect(isGoogleOAuthConfigured({ clientId: "id", clientSecret: "secret", redirectUri: "https://example.com/callback" })).toBe(true);
    expect(isGoogleOAuthConfigured({ clientId: "id", clientSecret: "secret" })).toBe(false);
  });

  it("hashes OAuth state and encrypts stored credentials without leaving plaintext in the payload", () => {
    const state = "user-1.random-state";
    expect(hashOAuthState(state)).not.toBe(state);
    const protectedValue = encryptGoogleCredential("refresh-token", "test-only-key");
    expect(protectedValue).not.toContain("refresh-token");
    expect(decryptGoogleCredential(protectedValue, "test-only-key")).toBe("refresh-token");
  });
});
