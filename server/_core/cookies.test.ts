import { describe, expect, it } from "vitest";
import { getSessionCookieOptions } from "./cookies";

describe("session cookie policy", () => {
  it("uses a secure same-site policy for HTTPS requests", () => {
    const options = getSessionCookieOptions({ protocol: "https", headers: {} } as never);
    expect(options).toMatchObject({ httpOnly: true, path: "/", sameSite: "lax", secure: true });
  });

  it("recognizes the HTTPS proxy header without broadening SameSite", () => {
    const options = getSessionCookieOptions({ protocol: "http", headers: { "x-forwarded-proto": "https" } } as never);
    expect(options).toMatchObject({ sameSite: "lax", secure: true });
  });
});
