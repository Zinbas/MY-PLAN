import type { NextFunction, Request, Response } from "express";

type RequestLike = Pick<Request, "method" | "headers">;

function header(request: RequestLike, name: string) {
  const value = request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

export function isSameOriginUnsafeRequest(request: RequestLike) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method.toUpperCase())) return true;
  const origin = header(request, "origin");
  if (!origin) return true;
  const host = header(request, "host");
  if (!host) return false;
  try {
    return new URL(origin).host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}

export function securityHeaders(request: Request, response: Response, next: NextFunction) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  response.setHeader("Content-Security-Policy", "base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
  if (request.path.startsWith("/api/")) response.setHeader("Cache-Control", "no-store");

  const forwarded = header(request, "x-forwarded-proto");
  if (request.protocol === "https" || forwarded?.split(",").some(value => value.trim() === "https")) {
    response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  if (!isSameOriginUnsafeRequest(request)) {
    response.status(403).json({ error: "Cross-origin write requests are not accepted." });
    return;
  }
  next();
}
