export type DevicePermissionState = "checking" | "unsupported" | "default" | "granted" | "denied";
export type DeviceConnectionState = "checking" | "connected" | "not-connected";

type DeviceReminderAccessInput = {
  permission: DevicePermissionState;
  deliveryReady: boolean;
  hasLocalSubscription: boolean;
  connection: DeviceConnectionState;
};

export function deviceReminderAccessStatus({ permission, deliveryReady, hasLocalSubscription, connection }: DeviceReminderAccessInput) {
  if (permission === "unsupported") return { heading: "This browser cannot receive device reminders.", body: "Use the in-app Notification Center here, or open MY PLAN in a modern browser that supports notifications.", permissionLabel: "Unavailable", connectionLabel: "Unavailable", actionLabel: null, canEnable: false } as const;
  if (permission === "denied") return { heading: "Notifications are blocked in this browser.", body: "MY PLAN cannot ask again until you change this site’s notification permission in your browser settings.", permissionLabel: "Blocked", connectionLabel: "Not connected", actionLabel: null, canEnable: false } as const;
  if (!deliveryReady) return { heading: "Device delivery is being prepared.", body: "MY PLAN will request notification permission only after secure device delivery is available.", permissionLabel: permission === "granted" ? "Allowed" : permission === "checking" ? "Checking" : "Not requested", connectionLabel: "Waiting for delivery", actionLabel: null, canEnable: false } as const;
  if (permission === "checking") return { heading: "Checking browser notification access.", body: "MY PLAN is reading this browser’s existing permission and device connection without sending a notification.", permissionLabel: "Checking", connectionLabel: "Checking", actionLabel: null, canEnable: false } as const;
  if (permission === "default") return { heading: "Allow notifications to connect this browser.", body: "Choose the button below and your browser will show its notification permission prompt. MY PLAN connects this device only if you allow it.", permissionLabel: "Not requested", connectionLabel: "Not connected", actionLabel: "Allow notifications and connect", canEnable: true } as const;
  if (connection === "checking") return { heading: "Checking this browser’s MY PLAN connection.", body: "Notifications are allowed. MY PLAN is confirming whether this specific browser is connected to your private account.", permissionLabel: "Allowed", connectionLabel: "Checking", actionLabel: null, canEnable: false } as const;
  if (connection === "connected") return { heading: "This browser is connected to MY PLAN.", body: "Notifications are allowed and this browser is enrolled for your private device reminders.", permissionLabel: "Allowed", connectionLabel: "Connected", actionLabel: null, canEnable: false } as const;
  if (hasLocalSubscription) return { heading: "Notifications are allowed; reconnect this browser.", body: "This browser has an existing notification subscription, but it is not currently connected to this MY PLAN account.", permissionLabel: "Allowed", connectionLabel: "Not connected", actionLabel: "Reconnect this browser", canEnable: true } as const;
  return { heading: "Notifications are allowed; connect this browser.", body: "MY PLAN has permission, but this browser is not yet connected to your private device reminders.", permissionLabel: "Allowed", connectionLabel: "Not connected", actionLabel: "Connect this browser", canEnable: true } as const;
}
