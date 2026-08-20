import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { ENV, isAdminGoogleEmail } from "./_core/env";
import type { TrpcContext } from "./_core/context";

function contextFor(role: "admin" | "user"): TrpcContext {
  return {
    user: {
      id: 1,
      openId: `${role}-user`,
      email: role === "admin" ? ENV.adminGoogleEmail : "ordinary@example.com",
      name: role === "admin" ? "Administrator" : "Ordinary user",
      loginMethod: "google",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("administrator identity and access", () => {
  it("validates the configured administrator Gmail allowlist", () => {
    expect(ENV.adminGoogleEmail).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    expect(isAdminGoogleEmail(ENV.adminGoogleEmail.toUpperCase())).toBe(true);
    expect(isAdminGoogleEmail("ordinary@example.com")).toBe(false);
  });

  it("allows only an administrator through the protected admin status endpoint", async () => {
    await expect(appRouter.createCaller(contextFor("user")).admin.status()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(appRouter.createCaller(contextFor("admin")).admin.status()).resolves.toMatchObject({ isAdmin: true, role: "admin" });
  });

  it("rejects the protected administrator overview before a non-administrator can access aggregated account data", async () => {
    await expect(appRouter.createCaller(contextFor("user")).admin.overview()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
