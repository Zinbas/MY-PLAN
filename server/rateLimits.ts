import type { Request, Response } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";

export const sensitiveRouteLimits = {
  oauthCallback: { windowMs: 15 * 60_000, max: 30 },
  mcp: { windowMs: 60_000, max: 120 },
  scheduleExtract: { windowMs: 15 * 60_000, max: 6 },
  assistantDraft: { windowMs: 5 * 60_000, max: 20 },
} as const;

function limitMessage(res: Response) {
  res.status(429).json({ error: "Too many requests. Please wait and try again." });
}

function keyForRequest(req: Request) {
  return ipKeyGenerator(req.ip || req.socket.remoteAddress || "unknown");
}

export function sensitiveRateLimit(policy: { windowMs: number; max: number }) {
  return rateLimit({
    windowMs: policy.windowMs,
    limit: policy.max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: keyForRequest,
    handler: (_req, res) => limitMessage(res),
  });
}
