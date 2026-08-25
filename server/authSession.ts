import { createHash } from "node:crypto";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { COOKIE_NAME } from "@shared/const";

/** Hashes the raw browser credential before it reaches persistence; raw session tokens are never stored. */
export function hashApplicationSession(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionTokenFromRequest(req: Pick<Request, "headers">) {
  const cookieToken = parseCookieHeader(req.headers.cookie ?? "")[COOKIE_NAME];
  if (cookieToken) return cookieToken;
  const authorization = req.headers.authorization;
  return typeof authorization === "string" && authorization.startsWith("Bearer ") ? authorization.slice(7).trim() || undefined : undefined;
}
