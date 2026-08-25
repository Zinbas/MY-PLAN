import { PushNotifications } from "@capacitor/push-notifications";
import { isNativeAndroidMyPlanApp } from "./capacitorRuntime";

export async function initializeNativeAndroidBridge() {
  if (!isNativeAndroidMyPlanApp()) return;
  await PushNotifications.createChannel({ id: "my_plan_reminders", name: "MY PLAN reminders", description: "Your chosen MY PLAN reminders", importance: 3, vibration: true, visibility: 0 }).catch(() => undefined);
}

export async function getNativeAndroidNotificationPermission() {
  if (!isNativeAndroidMyPlanApp()) return "unsupported" as const;
  const permission = await PushNotifications.checkPermissions();
  return permission.receive;
}

/** Requests the Android permission only from a deliberate user action and returns the FCM token on success. */
export async function requestNativeAndroidNotificationToken() {
  if (!isNativeAndroidMyPlanApp()) throw new Error("Native Android notifications are unavailable in this browser.");
  const permission = await PushNotifications.checkPermissions();
  const resolved = permission.receive === "prompt" ? await PushNotifications.requestPermissions() : permission;
  if (resolved.receive !== "granted") throw new Error("Android notification permission was not granted.");
  await initializeNativeAndroidBridge();
  return new Promise<string>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("Android notification registration timed out.")), 15_000);
    void PushNotifications.addListener("registration", token => { window.clearTimeout(timeout); resolve(token.value); });
    void PushNotifications.addListener("registrationError", error => { window.clearTimeout(timeout); reject(new Error(error.error || "Android notification registration failed.")); });
    void PushNotifications.register();
  });
}
