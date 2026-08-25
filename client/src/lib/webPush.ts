export type SerializablePushSubscription = {
  endpoint: string;
  expirationTime: number | null;
  keys: { p256dh: string; auth: string };
};

export function webPushSupport() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** Registers the existing safe worker for installability and offline-shell support without requesting notification permission. */
export async function registerMyPlanServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return undefined;
  return navigator.serviceWorker.register("/my-plan-sw.js", { scope: "/" });
}

function base64UrlToUint8Array(value: string) {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}

export async function createMyPlanPushSubscription(publicKey: string): Promise<SerializablePushSubscription> {
  if (!webPushSupport()) throw new Error("This browser does not support device reminders.");
  const registration = await registerMyPlanServiceWorker();
  if (!registration) throw new Error("MY PLAN could not register this browser for device reminders.");
  await navigator.serviceWorker.ready;
  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notifications are not enabled for MY PLAN in this browser.");
  const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToUint8Array(publicKey),
  });
  const raw = subscription.toJSON();
  if (!raw.endpoint || !raw.keys?.p256dh || !raw.keys.auth) throw new Error("This browser did not return a usable device subscription.");
  return { endpoint: raw.endpoint, expirationTime: raw.expirationTime ?? null, keys: { p256dh: raw.keys.p256dh, auth: raw.keys.auth } };
}

export async function removeMyPlanPushSubscription() {
  if (!webPushSupport()) return;
  const registration = await navigator.serviceWorker.getRegistration("/");
  await registration?.pushManager.getSubscription().then(subscription => subscription?.unsubscribe());
}
