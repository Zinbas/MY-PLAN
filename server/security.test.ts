import { describe, expect, it } from "vitest";
import { isSameOriginUnsafeRequest, securityHeaders } from "./security";

describe("HTTP security boundaries", () => {
  it("allows same-origin and server-to-server writes while rejecting a mismatched browser origin", () => {
    expect(isSameOriginUnsafeRequest({ method: "POST", headers: { host: "myplan.example" , origin: "https://myplan.example" } } as any)).toBe(true);
    expect(isSameOriginUnsafeRequest({ method: "POST", headers: { host: "myplan.example" } } as any)).toBe(true);
    expect(isSameOriginUnsafeRequest({ method: "POST", headers: { host: "myplan.example", origin: "https://attacker.example" } } as any)).toBe(false);
    expect(isSameOriginUnsafeRequest({ method: "GET", headers: { host: "myplan.example", origin: "https://attacker.example" } } as any)).toBe(true);
  });

  it("adds conservative browser protections and returns a generic blocked-write error", () => {
    const headers: Record<string, string> = {};
    let status = 200; let payload: unknown; let proceeded = false;
    const response = {
      setHeader: (name: string, value: string) => { headers[name] = value; },
      status: (code: number) => { status = code; return response; },
      json: (value: unknown) => { payload = value; return response; },
    };
    securityHeaders({ method: "POST", path: "/api/mcp", protocol: "https", headers: { host: "myplan.example", origin: "https://attacker.example" } } as any, response as any, () => { proceeded = true; });
    expect(headers).toMatchObject({ "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "strict-origin-when-cross-origin", "Content-Security-Policy": "base-uri 'self'; form-action 'self'; frame-ancestors 'none'", "Cache-Control": "no-store", "Strict-Transport-Security": "max-age=31536000; includeSubDomains" });
    expect(status).toBe(403);
    expect(payload).toEqual({ error: "Cross-origin write requests are not accepted." });
    expect(proceeded).toBe(false);
  });
});
