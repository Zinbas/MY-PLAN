import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { ENV, isAdminGoogleEmail } from "./_core/env";
import type { TrpcContext } from "./_core/context";
import { canViewAdminControls, mergeWorkspaceItemsById, workspaceScopeFor, workspaceStorageKey } from "../client/src/lib/privateWorkspace";

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

  it("shows administrator controls only to an authenticated administrator", () => {
    expect(canViewAdminControls(false, "admin")).toBe(false);
    expect(canViewAdminControls(true, "user")).toBe(false);
    expect(canViewAdminControls(true, "admin")).toBe(true);
  });

  it("keeps private workspaces isolated and preserves administrator legacy plan records at first sign-in", () => {
    expect(workspaceScopeFor(false)).toBe("guest");
    expect(workspaceScopeFor(true, 7)).toBe("user-7");
    expect(workspaceStorageKey("tasks", "user-7")).not.toBe(workspaceStorageKey("tasks", "user-8"));
    expect(mergeWorkspaceItemsById([{ id: "legacy-plan", title: "Existing academic plan" }], [{ id: "private-plan", title: "New private plan" }])).toEqual([
      { id: "legacy-plan", title: "Existing academic plan" },
      { id: "private-plan", title: "New private plan" },
    ]);
    expect(mergeWorkspaceItemsById([{ id: "shared", title: "Legacy value" }], [{ id: "shared", title: "Private value" }])).toEqual([{ id: "shared", title: "Private value" }]);
  });
});
