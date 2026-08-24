import { describe, expect, it } from "vitest";
import { createDeliveryKey, isExpiredPushSubscriptionError, isWithinQuietHours, isValidQuietHour, nextPushDeliveryAfterQuietHours, normalizePushSubscription, pushReadiness } from "./push";

describe("native web-push setup", () => {
  it("returns only the public VAPID key when valid server configuration is present", () => {
    const readiness = pushReadiness({ publicKey: "public-key", privateKey: "private-key", subject: "mailto:owner@example.test" });
    expect(readiness).toEqual(expect.objectContaining({ ready: true, publicKey: "public-key" }));
    expect(JSON.stringify(readiness)).not.toContain("private-key");
  });

  it("validates subscription material and produces stable delivery keys", () => {
    expect(() => normalizePushSubscription({ endpoint: "https://push.example.test/subscription", expirationTime: null, keys: { p256dh: "short", auth: "short" } })).toThrow("Invalid push subscription keys");
    const subscription = normalizePushSubscription({ endpoint: "https://push.example.test/subscription", expirationTime: null, keys: { p256dh: "0123456789abcdef_ABC", auth: "0123456789abcdef_ABC" } });
    expect(subscription.endpoint).toContain("push.example.test");
    const scheduledAt = new Date("2026-08-24T09:00:00.000Z");
    expect(createDeliveryKey(7, "task", "t-1", scheduledAt)).toBe(createDeliveryKey(7, "task", "t-1", scheduledAt));
  });

  it("uses strict local quiet-hour boundaries", () => {
    expect(isValidQuietHour("22:30")).toBe(true);
    expect(isValidQuietHour("25:30")).toBe(false);
    expect(isWithinQuietHours(new Date("2026-08-24T18:45:00.000Z"), "Asia/Kolkata", "23:00", "07:00")).toBe(true);
    expect(isWithinQuietHours(new Date("2026-08-24T06:30:00.000Z"), "Asia/Kolkata", "23:00", "07:00")).toBe(false);
  });

  it("defers quiet-time deliveries to the local quiet-hours end and recognizes invalid-device responses", () => {
    expect(nextPushDeliveryAfterQuietHours(new Date("2026-08-24T18:45:00.000Z"), "Asia/Kolkata", "23:00", "07:00").toISOString()).toBe("2026-08-25T01:30:00.000Z");
    expect(isExpiredPushSubscriptionError({ statusCode: 410 })).toBe(true);
    expect(isExpiredPushSubscriptionError({ statusCode: 503 })).toBe(false);
  });
});
