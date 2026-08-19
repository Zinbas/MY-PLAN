/**
 * Google Calendar HTTP endpoints. They return an explicit activation response when OAuth
 * credentials are absent; once configured, the authorization route begins Google consent.
 */
import type { Express, Request, Response } from "express";
import { buildGoogleAuthorizationUrl, createConnectionState, encryptGoogleCredential, exchangeGoogleAuthorizationCode, getGoogleOAuthConfig, getGoogleProfile, googleActivationChecklist, hashOAuthState, isGoogleOAuthConfigured } from "./googleOAuth";
import { consumeGoogleOAuthState, createGoogleOAuthState, upsertGoogleCalendarConnection } from "./db";
import { sdk } from "./_core/sdk";

function activationResponse(res: Response) {
  return res.status(503).json({
    code: "GOOGLE_OAUTH_NOT_CONFIGURED",
    message: "Google Calendar activation requires the app owner's Google OAuth credentials.",
    checklist: googleActivationChecklist,
  });
}

export function registerGoogleCalendarRoutes(app: Express) {
  app.get("/api/google/health", (_req, res) => {
    res.json({ ready: isGoogleOAuthConfigured(), mode: isGoogleOAuthConfigured() ? "live" : "demo" });
  });

  app.get("/api/google/connect", async (req: Request, res: Response) => {
    const config = getGoogleOAuthConfig();
    if (!isGoogleOAuthConfigured(config)) return activationResponse(res);
    const configured = config as Required<typeof config>;
    try {
      const user = await sdk.authenticateRequest(req);
      const state = createConnectionState(user.id);
      await createGoogleOAuthState(user.id, hashOAuthState(state), new Date(Date.now() + 10 * 60 * 1000));
      return res.redirect(buildGoogleAuthorizationUrl(configured, state));
    } catch {
      return res.status(401).json({ code: "AUTH_REQUIRED", message: "Sign in to MY PLAN before linking a Google account." });
    }
  });

  app.get("/api/google/callback", async (req, res) => {
    const config = getGoogleOAuthConfig();
    if (!isGoogleOAuthConfigured(config)) return activationResponse(res);
    const code = typeof req.query.code === "string" ? req.query.code : undefined;
    const state = typeof req.query.state === "string" ? req.query.state : undefined;
    if (!code || !state) return res.status(400).json({ code: "INVALID_CALLBACK", message: "Google did not provide a code and state." });
    try {
      const oauthState = await consumeGoogleOAuthState(hashOAuthState(state));
      if (!oauthState) return res.status(400).json({ code: "INVALID_STATE", message: "The Google authorization state was invalid or expired." });
      const token = await exchangeGoogleAuthorizationCode(config as Required<typeof config>, code);
      const profile = await getGoogleProfile(token.access_token);
      await upsertGoogleCalendarConnection({
        userId: oauthState.userId,
        googleSubject: profile.sub,
        email: profile.email,
        accountType: profile.hd ? "workspace" : "google",
        scopes: token.scope ?? null,
        encryptedAccessToken: encryptGoogleCredential(token.access_token),
        encryptedRefreshToken: token.refresh_token ? encryptGoogleCredential(token.refresh_token) : null,
      });
      return res.redirect("/?google=connected");
    } catch (error) {
      console.error("[Google OAuth] Callback failed", error);
      return res.redirect("/?google=error");
    }
  });

  app.post("/api/google/webhooks/calendar", (req, res) => {
    const resourceState = req.header("x-goog-resource-state");
    // A complete live deployment validates the stored channel token then queues incremental sync.
    // Returning 204 keeps Google’s webhook channel healthy while demo mode has no channels to process.
    if (!resourceState) return res.status(400).json({ error: "Missing Google resource state" });
    return res.status(204).end();
  });
}
