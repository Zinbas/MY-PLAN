import { afterEach, describe, expect, it, vi } from "vitest";
import { getMyPlanPushSubscription } from "./webPush";

describe("MY PLAN device reminder opt-in boundary", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("checks an existing browser subscription without requesting notification permission", async () => {
    const requestPermission = vi.fn();
    const getSubscription = vi.fn().mockResolvedValue(null);
    const register = vi.fn().mockResolvedValue({ pushManager: { getSubscription } });

    vi.stubGlobal("window", { PushManager: class PushManager {}, Notification: {} });
    vi.stubGlobal("navigator", { serviceWorker: { register } });
    vi.stubGlobal("Notification", { permission: "default", requestPermission });

    await expect(getMyPlanPushSubscription()).resolves.toBeNull();
    expect(register).toHaveBeenCalledWith("/my-plan-sw.js", { scope: "/" });
    expect(getSubscription).toHaveBeenCalledTimes(1);
    expect(requestPermission).not.toHaveBeenCalled();
  });
});
