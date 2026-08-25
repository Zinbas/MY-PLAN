import { createHash } from "node:crypto";
import webpush from "web-push";
import { decryptGoogleCredential, encryptGoogleCredential } from "./googleOAuth";

export const allowedReminderLeadMinutes = [0, 10, 30, 60, 24 * 60] as const;
export type ReminderLeadMinutes = (typeof allowedReminderLeadMinutes)[number];
export type PushTargetSection = "calendar" | "todo";
export type PushSourceKind = "task" | "event" | "block";
export type BrowserPushSubscription = { endpoint: string; expirationTime: number | null; keys: { p256dh: string; auth: string } };

type PushConfig = { publicKey?: string; privateKey?: string; subject?: string };

export function getPushConfig(): PushConfig {
  return {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
    subject: process.env.VAPID_SUBJECT,
  };
}

export function isPushConfigured(config = getPushConfig()) {
  return Boolean(config.publicKey && config.privateKey && config.subject && /^(mailto:|https:\/\/)/.test(config.subject));
}

export function pushReadiness(config = getPushConfig()) {
  const ready = isPushConfigured(config);
  return {
    ready,
    mode: ready ? "live" as const : "setup-pending" as const,
    publicKey: ready ? config.publicKey! : null,
    message: ready
      ? "Device reminders are ready to enable on this browser."
      : "Device reminders are being prepared. You can still set your reminder preferences; delivery activates after the owner securely configures the MY PLAN notification keys.",
  };
}

export function isAllowedReminderLeadMinutes(value: number): value is ReminderLeadMinutes {
  return (allowedReminderLeadMinutes as readonly number[]).includes(value);
}

export function isValidQuietHour(value: string | null | undefined) {
  return value == null || /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function normalizePushSubscription(input: BrowserPushSubscription): BrowserPushSubscription {
  if (!/^https:\/\//.test(input.endpoint) || input.endpoint.length > 2_000) throw new Error("Invalid push endpoint");
  if (!/^[A-Za-z0-9_-]{16,}$/.test(input.keys.p256dh) || !/^[A-Za-z0-9_-]{16,}$/.test(input.keys.auth)) throw new Error("Invalid push subscription keys");
  if (input.expirationTime !== null && (!Number.isFinite(input.expirationTime) || input.expirationTime <= Date.now())) throw new Error("Invalid push subscription expiry");
  return input;
}

export function hashPushEndpoint(endpoint: string) {
  return createHash("sha256").update(endpoint).digest("hex");
}

export function encryptPushSubscription(input: BrowserPushSubscription) {
  return encryptGoogleCredential(JSON.stringify(input));
}

export function decryptPushSubscription(input: string) {
  return normalizePushSubscription(JSON.parse(decryptGoogleCredential(input)) as BrowserPushSubscription);
}

export function createDeliveryKey(userId: number, sourceKind: PushSourceKind, sourceId: string, scheduledAt: Date) {
  return createHash("sha256").update(`${userId}:${sourceKind}:${sourceId}:${scheduledAt.toISOString()}`).digest("hex");
}

export function notificationRoute(targetSection: PushTargetSection, sourceId: string) {
  const route = targetSection === "todo" ? "todo" : "calendar";
  return `/?section=${route}&reminder=${encodeURIComponent(sourceId)}`;
}

export function isWithinQuietHours(now: Date, timeZone: string | null, start: string | null, end: string | null) {
  if (!timeZone || !start || !end || start === end) return false;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const hour = parts.find(part => part.type === "hour")?.value ?? "00";
  const minute = parts.find(part => part.type === "minute")?.value ?? "00";
  const current = `${hour}:${minute}`;
  return start < end ? current >= start && current < end : current >= start || current < end;
}

/** Return the earliest practical post-quiet delivery time without requesting browser or user data. */
export function nextPushDeliveryAfterQuietHours(now: Date, timeZone: string | null, start: string | null, end: string | null) {
  if (!timeZone || !isWithinQuietHours(now, timeZone, start, end) || !end) return now;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const hour = Number(parts.find(part => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find(part => part.type === "minute")?.value ?? "0");
  const currentMinutes = hour * 60 + minute;
  const [endHour, endMinute] = end.split(":").map(Number);
  const endMinutes = endHour * 60 + endMinute;
  const minutesUntilEnd = (endMinutes - currentMinutes + 1_440) % 1_440 || 1_440;
  return new Date(now.getTime() + minutesUntilEnd * 60_000);
}

export function pushDeliveryStatusCode(error: unknown) {
  if (!error || typeof error !== "object" || !("statusCode" in error)) return null;
  const statusCode = (error as { statusCode?: unknown }).statusCode;
  return typeof statusCode === "number" && Number.isInteger(statusCode) ? statusCode : null;
}

export function isExpiredPushSubscriptionError(error: unknown) {
  const statusCode = pushDeliveryStatusCode(error);
  return statusCode === 404 || statusCode === 410;
}

export async function sendPushNotification(subscription: BrowserPushSubscription, payload: { title: string; body: string; route: string; tag: string }, config = getPushConfig()) {
  if (!isPushConfigured(config)) throw new Error("Native web push is not configured");
  webpush.setVapidDetails(config.subject!, config.publicKey!, config.privateKey!);
  return webpush.sendNotification(subscription, JSON.stringify({ ...payload, icon: "/manus-storage/my-plan-note-mark_567e5611.jpg", badge: "/manus-storage/my-plan-note-mark_567e5611.jpg" }), { TTL: 60 * 60 });
}
