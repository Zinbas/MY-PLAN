import { describe, expect, it } from "vitest";
import { safelySetBrowserStorage } from "./safeBrowserStorage";

describe("safelySetBrowserStorage", () => {
  it("keeps the caller running when a restrictive browser denies storage", () => {
    const blockedStorage = { setItem: () => { throw new Error("SecurityError"); } };

    expect(safelySetBrowserStorage(blockedStorage, "auth", "user")).toBe(false);
  });

  it("writes normally when browser storage is available", () => {
    const values = new Map<string, string>();
    const storage = { setItem: (key: string, value: string) => values.set(key, value) };

    expect(safelySetBrowserStorage(storage, "auth", "user")).toBe(true);
    expect(values.get("auth")).toBe("user");
  });
});
