import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getPushReminderPreferences: vi.fn(),
    listActivePushSubscriptions: vi.fn(),
    upsertPushReminderDelivery: vi.fn(),
  };
});

import { getPushReminderPreferences, listActivePushSubscriptions, upsertPushReminderDelivery } from "./db";
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
});
