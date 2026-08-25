import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
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

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.disable("x-powered-by");
  // MY PLAN is served behind one trusted hosting proxy; this restores the originating client IP
  // for narrow abuse controls without trusting an arbitrary multi-hop header chain.
  app.set("trust proxy", 1);
  app.use(securityHeaders);
  // Schedule files are limited to 10 MB after decoding; keep request parsing close to that boundary.
  app.use(express.json({ limit: "15mb" }));
  app.use(express.urlencoded({ limit: "16kb", extended: false }));
  app.use("/api/oauth/callback", sensitiveRateLimit(sensitiveRouteLimits.oauthCallback));
  app.use("/api/mcp", sensitiveRateLimit(sensitiveRouteLimits.mcp));
  app.use("/api/trpc/schedule.extract", sensitiveRateLimit(sensitiveRouteLimits.scheduleExtract));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerGoogleCalendarRoutes(app);
  registerMcpRoutes(app);
  registerPushRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
