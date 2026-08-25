import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getPushReminderPreferences: vi.fn(),
    listActivePushSubscriptions: vi.fn(),
    syncOwnedPersonalReminderItems: vi.fn(),
    cancelOwnedPushReminderDeliveries: vi.fn(),
    upsertPushReminderDelivery: vi.fn(),
  };
});

import { cancelOwnedPushReminderDeliveries, getPushReminderPreferences, listActivePushSubscriptions, syncOwnedPersonalReminderItems, upsertPushReminderDelivery } from "./db";
import { appRouter } from "./routers";

function signedInContext(): TrpcContext {
  const now = new Date();
  return {
    user: { id: 47, openId: "reminder-test-user", email: "reminder@example.test", name: "Reminder test", loginMethod: "email", role: "user", createdAt: now, updatedAt: now, lastSignedIn: now },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("MY PLAN reminder scheduling enrollment", () => {
  it("does not persist an off-app delivery before an enabled browser subscription exists", async () => {
    vi.mocked(getPushReminderPreferences).mockResolvedValue({ id: null, userId: 47, enabled: false, defaultLeadMinutes: 10, quietHoursStart: null, quietHoursEnd: null, timeZone: null });
    vi.mocked(listActivePushSubscriptions).mockResolvedValue([]);
    const caller = appRouter.createCaller(signedInContext());

    await expect(caller.push.scheduleDelivery({
      sourceKind: "task",
      sourceId: "private-task-1",
      title: "Private task",
      body: "Review your plan",
      targetSection: "todo",
      scheduledAt: new Date(Date.now() + 60_000),
    })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(upsertPushReminderDelivery).not.toHaveBeenCalled();
  });

  it("uses an item-level lead over the account default when enrolling an approved local plan", async () => {
    vi.mocked(getPushReminderPreferences).mockResolvedValue({ id: null, userId: 47, enabled: true, defaultLeadMinutes: 60, quietHoursStart: null, quietHoursEnd: null, timeZone: null });
    vi.mocked(listActivePushSubscriptions).mockResolvedValue([{ id: 1, expiresAt: null }] as any);
    vi.mocked(syncOwnedPersonalReminderItems).mockImplementation(async (_userId, items) => ({ activeCount: items.length, itemsToSchedule: items, deliveryKeysToCancel: [] }));
    vi.mocked(cancelOwnedPushReminderDeliveries).mockResolvedValue(undefined);
    vi.mocked(upsertPushReminderDelivery).mockResolvedValue(undefined);
    const occursAt = new Date(Date.now() + 24 * 60 * 60_000);
    const caller = appRouter.createCaller(signedInContext());

    await caller.push.syncPersonalEnrollment({ items: [{ sourceKind: "task", sourceId: "task-15", title: "Send draft", body: "Task due", targetSection: "todo", occursAt, leadMinutes: 10 }] });

    expect(syncOwnedPersonalReminderItems).toHaveBeenCalledWith(47, [expect.objectContaining({ leadMinutes: 10, scheduledAt: new Date(occursAt.getTime() - 10 * 60_000) })]);
  });
});
