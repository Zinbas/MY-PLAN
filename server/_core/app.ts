import express, { type Express } from "express";
import type { Server } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { registerGoogleCalendarRoutes } from "../googleRoutes";
import { registerMcpRoutes } from "../mcpRoutes";
import { registerPushRoutes } from "../pushRoutes";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { securityHeaders } from "../security";
import { sensitiveRateLimit, sensitiveRouteLimits } from "../rateLimits";

/**
 * Build the application without opening a listening socket. This is the
 * boundary shared by the local Node server and Vercel's serverless handler.
 */
export async function createApp(server?: Server): Promise<Express> {
  const app = express();
  app.disable("x-powered-by");
  // MY PLAN is served behind one trusted hosting proxy; this restores the
  // originating client IP for narrow abuse controls without trusting an
  // arbitrary multi-hop header chain.
  app.set("trust proxy", 1);
  app.use(securityHeaders);
  // Schedule files are limited to 10 MB after decoding; keep request parsing
  // close to that boundary.
  app.use(express.json({ limit: "15mb" }));
  app.use(express.urlencoded({ limit: "16kb", extended: false }));
  app.use("/api/oauth/callback", sensitiveRateLimit(sensitiveRouteLimits.oauthCallback));
  app.use("/api/mcp", sensitiveRateLimit(sensitiveRouteLimits.mcp));
  app.use("/api/trpc/schedule.extract", sensitiveRateLimit(sensitiveRouteLimits.scheduleExtract));
  app.use("/api/trpc/assistant.draft", sensitiveRateLimit(sensitiveRouteLimits.assistantDraft));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerGoogleCalendarRoutes(app);
  registerMcpRoutes(app);
  registerPushRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  if (process.env.NODE_ENV === "development") {
    if (!server) throw new Error("A local HTTP server is required in development mode");
    await setupVite(app, server);
  } else if (process.env.VERCEL !== "1") {
    // Vercel serves dist/public as static output. Keeping this for local
    // production mode preserves the existing `pnpm start` workflow.
    serveStatic(app);
  }

  return app;
}
