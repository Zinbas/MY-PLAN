import type { Express } from "express";
import { randomUUID } from "node:crypto";
import {
  claimDuePushReminderDeliveries,
  deferClaimedPushReminderDelivery,
  expirePushSubscription,
  getPushReminderPreferences,
  listActivePushSubscriptions,
  markPushReminderDeliverySent,
  requeueStalePushReminderDeliveryClaims,
  skipClaimedPushReminderDelivery,
  skipExpiredPendingPushReminderDeliveries,
} from "./db";
import {
  decryptPushSubscription,
  isExpiredPushSubscriptionError,
  isPushConfigured,
  isWithinQuietHours,
  nextPushDeliveryAfterQuietHours,
  pushDeliveryStatusCode,
  sendPushNotification,
} from "./push";
import { sdk } from "./_core/sdk";

const DELIVERY_BATCH_SIZE = 25;
const STALE_CLAIM_MS = 5 * 60_000;
const MAX_DELIVERY_AGE_MS = 60 * 60_000;
const RETRY_DELAY_MS = 5 * 60_000;
const MAX_ATTEMPTS = 3;

export async function dispatchDuePushReminders(now = new Date()) {
  if (!isPushConfigured()) return { skipped: "vapid-not-configured" as const, claimed: 0, sent: 0, deferred: 0, skippedDeliveries: 0, retried: 0 };
  await requeueStalePushReminderDeliveryClaims(new Date(now.getTime() - STALE_CLAIM_MS));
  await skipExpiredPendingPushReminderDeliveries(new Date(now.getTime() - MAX_DELIVERY_AGE_MS));
  const claimToken = randomUUID();
  const deliveries = await claimDuePushReminderDeliveries(now, DELIVERY_BATCH_SIZE, claimToken);
  const result = { claimed: deliveries.length, sent: 0, deferred: 0, skippedDeliveries: 0, retried: 0 };

  for (const delivery of deliveries) {
    const preferences = await getPushReminderPreferences(delivery.userId);
    if (!preferences.enabled) {
      await skipClaimedPushReminderDelivery(delivery.id, claimToken);
      result.skippedDeliveries++;
      continue;
    }
    if (isWithinQuietHours(now, preferences.timeZone, preferences.quietHoursStart, preferences.quietHoursEnd)) {
      await deferClaimedPushReminderDelivery(delivery.id, claimToken, nextPushDeliveryAfterQuietHours(now, preferences.timeZone, preferences.quietHoursStart, preferences.quietHoursEnd));
      result.deferred++;
      continue;
    }

    const subscriptions = await listActivePushSubscriptions(delivery.userId);
    if (!subscriptions.length) {
      await skipClaimedPushReminderDelivery(delivery.id, claimToken);
      result.skippedDeliveries++;
      continue;
    }

    let delivered = false;
    let usableSubscriptionCount = 0;
    for (const subscription of subscriptions) {
      if (subscription.expiresAt && subscription.expiresAt <= now) {
        await expirePushSubscription(subscription.id, "subscription-expired");
        continue;
      }
      usableSubscriptionCount++;
      try {
        await sendPushNotification(decryptPushSubscription(subscription.encryptedSubscription), {
          title: delivery.title,
          body: delivery.body,
          route: `/?section=${delivery.targetSection}&reminder=${encodeURIComponent(delivery.sourceId)}`,
          tag: `my-plan-${delivery.deliveryKey}`,
        });
        delivered = true;
      } catch (error) {
        if (isExpiredPushSubscriptionError(error)) await expirePushSubscription(subscription.id, `push-${pushDeliveryStatusCode(error)}`);
        else if (error instanceof SyntaxError) await expirePushSubscription(subscription.id, "invalid-subscription");
      }
    }
    if (delivered) {
      await markPushReminderDeliverySent(delivery.id, claimToken, now);
      result.sent++;
    } else if (!usableSubscriptionCount) {
      await skipClaimedPushReminderDelivery(delivery.id, claimToken);
      result.skippedDeliveries++;
    } else if (delivery.attemptCount >= MAX_ATTEMPTS) {
      await skipClaimedPushReminderDelivery(delivery.id, claimToken);
      result.skippedDeliveries++;
    } else {
      await deferClaimedPushReminderDelivery(delivery.id, claimToken, new Date(now.getTime() + RETRY_DELAY_MS));
      result.retried++;
    }
  }
  return result;
}

export function registerPushRoutes(app: Express) {
  app.post("/api/scheduled/dispatch-push-reminders", async (req, res) => {
    let taskUid: string | undefined;
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
      taskUid = user.taskUid;
      return res.json({ ok: true, ...(await dispatchDuePushReminders()) });
    } catch (error) {
      if (error && typeof error === "object" && "statusCode" in error && (error as { statusCode?: unknown }).statusCode === 403) {
        return res.status(403).json({ error: "cron-only" });
      }
      console.error("[MY PLAN Push] Scheduled delivery failed", error);
      return res.status(500).json({
        error: "MY PLAN device reminder dispatch failed.",
        context: { taskUid: taskUid ?? null },
        timestamp: new Date().toISOString(),
      });
    }
  });
}
