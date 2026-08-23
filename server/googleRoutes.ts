/**
 * Google Calendar HTTP endpoints. They return an explicit activation response when OAuth
 * credentials are absent; once configured, the authorization route begins Google consent.
 */
import type { Express, Request, Response } from "express";
import { buildGoogleAuthorizationUrl, createConnectionState, encryptGoogleCredential, exchangeGoogleAuthorizationCode, getGoogleOAuthConfig, getGoogleProfile, googleActivationChecklist, googleOAuthReadiness, hashOAuthState, isGoogleOAuthConfigured } from "./googleOAuth";
import { consumeGoogleOAuthState, createGoogleOAuthState, getUserByOpenId, upsertGoogleCalendarConnection, upsertUser } from "./db";
import { sdk } from "./_core/sdk";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { getCalendarConnectionById, getLinkedCalendarById, getWatchChannel } from "./db";
import { importGoogleCalendarConnection, syncGoogleLinkedCalendar } from "./calendarSync";
import { renewExpiringGoogleWatchChannels } from "./calendarSync";

function activationResponse(res: Response) {
  return res.status(503).json({
    code: "GOOGLE_OAUTH_NOT_CONFIGURED",
    message: "Google Calendar activation requires the app owner's Google OAuth credentials.",
    checklist: googleActivationChecklist,
  });
}

export function registerGoogleCalendarRoutes(app: Express) {
  app.get("/api/google/health", (_req, res) => {
    res.json(googleOAuthReadiness());
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

  app.get("/api/google/sign-in", async (_req: Request, res: Response) => {
    const config = getGoogleOAuthConfig();
    if (!isGoogleOAuthConfigured(config)) return activationResponse(res);
    const state = createConnectionState();
    await createGoogleOAuthState(null, hashOAuthState(state), new Date(Date.now() + 10 * 60 * 1000));
    return res.redirect(buildGoogleAuthorizationUrl(config as Required<typeof config>, state));
  });

  app.get("/api/google/callback", async (req, res) => {
    const config = getGoogleOAuthConfig();
    if (!isGoogleOAuthConfigured(config)) return activationResponse(res);
    const configured = config as Required<typeof config>;
    const code = typeof req.query.code === "string" ? req.query.code : undefined;
    const state = typeof req.query.state === "string" ? req.query.state : undefined;
    if (!code || !state) return res.status(400).json({ code: "INVALID_CALLBACK", message: "Google did not provide a code and state." });
    try {
      const oauthState = await consumeGoogleOAuthState(hashOAuthState(state));
      if (!oauthState) return res.status(400).json({ code: "INVALID_STATE", message: "The Google authorization state was invalid or expired." });
      const token = await exchangeGoogleAuthorizationCode(configured, code);
      const profile = await getGoogleProfile(token.access_token);
      if (!oauthState.userId) {
        const openId = `google:${profile.sub}`;
        await upsertUser({ openId, name: profile.name ?? null, email: profile.email, loginMethod: "google", lastSignedIn: new Date() });
        const signedInUser = await getUserByOpenId(openId);
        if (!signedInUser) throw new Error("Google user account could not be created");
        const session = await sdk.createSessionToken(openId, { name: signedInUser.name ?? "Google user" });
        res.cookie(COOKIE_NAME, session, getSessionCookieOptions(req));
        return res.redirect("/?google=signed-in");
      }
      const connection = await upsertGoogleCalendarConnection({
        userId: oauthState.userId,
        googleSubject: profile.sub,
        email: profile.email,
        accountType: profile.hd ? "workspace" : "google",
        scopes: token.scope ?? null,
        encryptedAccessToken: encryptGoogleCredential(token.access_token),
        encryptedRefreshToken: token.refresh_token ? encryptGoogleCredential(token.refresh_token) : null,
        accessTokenExpiresAt: new Date(Date.now() + token.expires_in * 1000),
      });
      if (!connection) throw new Error("Google calendar connection could not be saved");
      const callbackUrl = new URL(configured.redirectUri).origin + "/api/google/webhooks/calendar";
      await importGoogleCalendarConnection(oauthState.userId, connection.id, callbackUrl);
      return res.redirect("/?google=connected");
    } catch (error) {
      console.error("[Google OAuth] Callback failed", error);
      return res.redirect("/?google=error");
    }
  });

  app.post("/api/google/webhooks/calendar", async (req, res) => {
    const resourceState = req.header("x-goog-resource-state");
    const channelId = req.header("x-goog-channel-id");
    const verificationToken = req.header("x-goog-channel-token");
    if (!resourceState) return res.status(400).json({ error: "Missing Google resource state" });
    if (!channelId || !verificationToken) return res.status(401).json({ error: "Missing Google watch channel verification" });
    try {
      const channel = await getWatchChannel(channelId, verificationToken);
      if (!channel || channel.expiresAt < new Date()) return res.status(401).json({ error: "Unknown or expired Google watch channel" });
      if (resourceState === "sync") return res.status(204).end();
      const calendar = await getLinkedCalendarById(channel.linkedCalendarId);
      if (!calendar) return res.status(204).end();
      const connection = await getCalendarConnectionById(calendar.connectionId);
      if (!connection) return res.status(204).end();
      await syncGoogleLinkedCalendar(connection, calendar.id);
      return res.status(204).end();
    } catch (error) {
      console.error("[Google Calendar] Webhook sync failed", error);
      return res.status(500).json({ error: "Google calendar synchronization failed" });
    }
  });

  app.post("/api/scheduled/renew-calendar-watches", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
      const config = getGoogleOAuthConfig();
      if (!isGoogleOAuthConfigured(config)) return res.json({ ok: true, skipped: "google-oauth-not-configured" });
      const callbackUrl = new URL((config as Required<typeof config>).redirectUri).origin + "/api/google/webhooks/calendar";
      const result = await renewExpiringGoogleWatchChannels(callbackUrl);
      return res.json({ ok: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown calendar watch renewal error";
      console.error("[Google Calendar] Watch renewal failed", error);
      return res.status(500).json({ error: message, timestamp: new Date().toISOString() });
    }
  });
}
