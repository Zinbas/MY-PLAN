import { COOKIE_NAME, OAUTH_STATE_COOKIE, SESSION_TTL_MS, decodeOAuthState } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { hashApplicationSession } from "../authSession";
import { ENV } from "./env";
import { createHash, randomBytes } from "node:crypto";

const opaqueValuePattern = /^[A-Za-z0-9_-]{43,128}$/;
const verifierHashPattern = /^[a-f0-9]{64}$/;

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

function hashOpaque(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function publicOrigin(req: Request) {
  const host = (req.headers["x-forwarded-host"] as string | undefined)?.split(",")[0]?.trim() || req.headers.host;
  const protocol = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim() || req.protocol || "https";
  return host ? `${protocol}://${host}` : "";
}

function nativeSuccessPage(code: string) {
  return `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>MY PLAN</title><main style="font-family:system-ui,sans-serif;max-width:30rem;margin:18vh auto;padding:1.5rem;text-align:center"><h1 style="font-size:1.5rem">Returning to MY PLAN…</h1><p style="color:#5b6158">Your sign-in is being secured on this device.</p></main><script>location.replace('/?native_auth_code=${encodeURIComponent(code)}')</script>`;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/mobile/oauth/start", (req: Request, res: Response) => {
    const verifierHash = getQueryParam(req, "verifierHash");
    const origin = publicOrigin(req);
    const portalUrl = process.env.VITE_OAUTH_PORTAL_URL;
    if (!verifierHash || !verifierHashPattern.test(verifierHash) || !origin || !portalUrl || !ENV.appId) {
      res.status(400).json({ error: "Invalid native sign-in request" });
      return;
    }
    const redirectUri = `${origin}/api/oauth/callback`;
    const state = Buffer.from(JSON.stringify({ redirectUri, nativeVerifierHash: verifierHash })).toString("base64");
    const url = new URL(`${portalUrl}/app-auth`);
    url.searchParams.set("appId", ENV.appId);
    url.searchParams.set("redirectUri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("type", "signIn");
    res.redirect(302, url.toString());
  });

  app.post("/api/mobile/oauth/exchange", async (req: Request, res: Response) => {
    const code = typeof req.body?.code === "string" ? req.body.code : "";
    const verifier = typeof req.body?.verifier === "string" ? req.body.verifier : "";
    if (!opaqueValuePattern.test(code) || !opaqueValuePattern.test(verifier)) {
      res.status(400).json({ error: "Invalid native sign-in exchange" });
      return;
    }
    try {
      const handoff = await db.consumeNativeOAuthHandoff(hashOpaque(code), hashOpaque(verifier));
      if (!handoff) {
        res.status(403).json({ error: "Native sign-in code is invalid or expired" });
        return;
      }
      const user = await db.getUserById(handoff.userId);
      if (!user) throw new Error("Native sign-in user no longer exists");
      const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name || "", expiresInMs: SESSION_TTL_MS });
      await db.createApplicationSession({ userId: user.id, tokenHash: hashApplicationSession(sessionToken), expiresAt: new Date(Date.now() + SESSION_TTL_MS) });
      res.status(200).json({ token: sessionToken, expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString() });
    } catch {
      if (!ENV.isProduction) console.error("[OAuth] Native exchange failed");
      res.status(500).json({ error: "Native sign-in exchange failed" });
    }
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    const oauthState = decodeOAuthState(state);
    const isNative = Boolean(oauthState.nativeVerifierHash && verifierHashPattern.test(oauthState.nativeVerifierHash));
    const expectedNonce = parseCookieHeader(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!isNative && (!oauthState.nonce || oauthState.nonce !== expectedNonce)) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    if (!isNative) res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "lax" });

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await db.upsertUser({ openId: userInfo.openId, name: userInfo.name || null, email: userInfo.email ?? null, loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null, lastSignedIn: new Date() });
      const user = await db.getUserByOpenId(userInfo.openId);
      if (!user) throw new Error("Session user was not created");

      if (isNative && oauthState.nativeVerifierHash) {
        const nativeCode = randomBytes(32).toString("base64url");
        await db.createNativeOAuthHandoff({ codeHash: hashOpaque(nativeCode), verifierHash: oauthState.nativeVerifierHash, userId: user.id, expiresAt: new Date(Date.now() + 5 * 60_000) });
        const origin = publicOrigin(req);
        if (!origin) throw new Error("Public origin unavailable");
        res.redirect(302, `${origin}/?native_auth_code=${encodeURIComponent(nativeCode)}`);
        return;
      }

      const sessionToken = await sdk.createSessionToken(userInfo.openId, { name: userInfo.name || "", expiresInMs: SESSION_TTL_MS });
      await db.createApplicationSession({ userId: user.id, tokenHash: hashApplicationSession(sessionToken), expiresAt: new Date(Date.now() + SESSION_TTL_MS) });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: SESSION_TTL_MS });
      res.redirect(302, "/");
    } catch {
      if (!ENV.isProduction) console.error("[OAuth] Callback failed");
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
