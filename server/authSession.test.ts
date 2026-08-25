import { describe, expect, it } from "vitest";
import { hashApplicationSession, sessionTokenFromRequest } from "./authSession";

describe("application session utilities", () => {
  it("derives a stable non-reversible token hash", () => {
    const hash = hashApplicationSession("session-secret-value");
    expect(hash).toHaveLength(64);
    expect(hash).toBe(hashApplicationSession("session-secret-value"));
    expect(hash).not.toContain("session-secret-value");
  });

  it("prefers the secure session cookie and supports the existing preview bearer fallback", () => {
    expect(sessionTokenFromRequest({ headers: { cookie: "app_session_id=cookie-token", authorization: "Bearer header-token" } } as never)).toBe("cookie-token");
    expect(sessionTokenFromRequest({ headers: { authorization: "Bearer header-token" } } as never)).toBe("header-token");
  });
});
