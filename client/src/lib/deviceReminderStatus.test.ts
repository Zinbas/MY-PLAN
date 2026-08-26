import { describe, expect, it } from "vitest";
import { deviceReminderAccessStatus } from "./deviceReminderStatus";

describe("device reminder browser access status", () => {
  it("makes the browser prompt action explicit before permission has been requested", () => {
    expect(deviceReminderAccessStatus({ permission: "default", deliveryReady: true, hasLocalSubscription: false, connection: "not-connected" })).toMatchObject({
      permissionLabel: "Not requested", connectionLabel: "Not connected", actionLabel: "Allow notifications and connect", canEnable: true,
    });
  });

  it("shows the current browser as connected only after its own connection is confirmed", () => {
    expect(deviceReminderAccessStatus({ permission: "granted", deliveryReady: true, hasLocalSubscription: true, connection: "connected" })).toMatchObject({
      permissionLabel: "Allowed", connectionLabel: "Connected", actionLabel: null,
    });
  });

  it("does not offer another prompt when browser notifications are blocked", () => {
    expect(deviceReminderAccessStatus({ permission: "denied", deliveryReady: true, hasLocalSubscription: false, connection: "not-connected" })).toMatchObject({
      permissionLabel: "Blocked", canEnable: false,
    });
  });

  it("labels an in-flight delivery-readiness query as checking instead of setup pending", () => {
    expect(deviceReminderAccessStatus({ permission: "default", deliveryReady: false, deliveryState: "checking", hasLocalSubscription: false, connection: "not-connected" })).toMatchObject({
      heading: "Checking MY PLAN device delivery.", connectionLabel: "Checking delivery", actionLabel: null, canEnable: false,
    });
  });

  it("distinguishes an unavailable readiness check from an actual unconfigured delivery service", () => {
    expect(deviceReminderAccessStatus({ permission: "granted", deliveryReady: false, deliveryState: "unavailable", hasLocalSubscription: false, connection: "not-connected" })).toMatchObject({
      heading: "MY PLAN could not verify device delivery.", connectionLabel: "Unable to verify", actionLabel: null, canEnable: false,
    });
  });
});
