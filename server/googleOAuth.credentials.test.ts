import { describe, expect, it } from "vitest";
import { getGoogleOAuthConfig, isGoogleOAuthConfigured } from "./googleOAuth";

describe("configured Google OAuth client", () => {
  it("is recognized by Google's token endpoint without exposing secret material", async () => {
    const config = getGoogleOAuthConfig();
    expect(isGoogleOAuthConfigured(config)).toBe(true);

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId!,
        client_secret: config.clientSecret!,
        redirect_uri: config.redirectUri!,
        code: "my-plan-credential-validation-not-an-authorization-code",
        grant_type: "authorization_code",
      }),
    });
    const payload = await response.json() as { error?: string };

    // A deliberately invalid one-time code should fail as invalid_grant only after
    // Google recognizes the configured OAuth client. Never log the response body.
    expect(response.status).toBe(400);
    expect(payload.error).toBe("invalid_grant");
  });
});
