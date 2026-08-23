import { describe, expect, it } from "vitest";
import { canViewAdminControls, mergeWorkspaceItemsById, workspaceScopeFor, workspaceStorageKey } from "./privateWorkspace";

describe("private MY PLAN workspaces", () => {
  it("gives the administrator and each signed-in user distinct storage scopes", () => {
    const adminScope = workspaceScopeFor(true, 1);
    const userScope = workspaceScopeFor(true, 2);
    expect(adminScope).toBe("user-1");
    expect(userScope).toBe("user-2");
    expect(workspaceStorageKey("tasks", adminScope)).not.toBe(workspaceStorageKey("tasks", userScope));
    expect(workspaceStorageKey("tasks", userScope)).not.toBe(workspaceStorageKey("tasks", workspaceScopeFor(false, 2)));
  });

  it("keeps administrator controls role-scoped while preserving the administrator baseline during first sign-in merging", () => {
    expect(canViewAdminControls(true, "admin")).toBe(true);
    expect(canViewAdminControls(true, "user")).toBe(false);
    expect(canViewAdminControls(false, "admin")).toBe(false);
    const baseline = [{ id: "assignment", title: "Assignment" }];
    const privateItems = [{ id: "assignment", title: "Updated assignment" }, { id: "private-task", title: "Private task" }];
    expect(mergeWorkspaceItemsById(baseline, privateItems)).toEqual([{ id: "assignment", title: "Updated assignment" }, { id: "private-task", title: "Private task" }]);
  });
});
