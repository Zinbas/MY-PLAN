export type WorkspaceRole = "admin" | "user" | null | undefined;

export function canViewAdminControls(isAuthenticated: boolean, role: WorkspaceRole) {
  return isAuthenticated && role === "admin";
}

export function workspaceScopeFor(isAuthenticated: boolean, userId?: number | null) {
  return isAuthenticated && userId ? `user-${userId}` : "guest";
}

export function workspaceStorageKey(kind: string, scope: string) {
  return `my-plan-${kind}:${scope}`;
}

/** Merge a first-sign-in legacy plan without replacing records already present in the private user workspace. */
export function mergeWorkspaceItemsById<T extends { id: string }>(legacyItems: T[], currentItems: T[]) {
  return Array.from(new Map([...legacyItems, ...currentItems].map(item => [item.id, item])).values());
}
