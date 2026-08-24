import { afterEach, describe, expect, it, vi } from "vitest";
import { dispatchDuePushReminders } from "./pushRoutes";

describe("scheduled MY PLAN device reminder dispatch", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("does not access persistence or attempt delivery before secure VAPID configuration exists", async () => {
    vi.stubEnv("VAPID_PUBLIC_KEY", "");
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    vi.stubEnv("VAPID_SUBJECT", "");
    await expect(dispatchDuePushReminders(new Date("2026-08-24T09:00:00.000Z"))).resolves.toEqual({
      skipped: "vapid-not-configured",
      claimed: 0,
      sent: 0,
      deferred: 0,
      skippedDeliveries: 0,
      retried: 0,
    });
  });
});
