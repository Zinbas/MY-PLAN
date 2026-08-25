import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

const publicContext = {
  user: null,
  req: {} as TrpcContext["req"],
  res: {} as TrpcContext["res"],
} satisfies TrpcContext;

describe("secured MY PLAN VAPID configuration", () => {
  it("reports configured readiness when VAPID is present and a safe setup-pending state when CI has no secrets", async () => {
    const readiness = await appRouter.createCaller(publicContext).push.readiness();
    if (readiness.ready) {
      expect(readiness).toMatchObject({ ready: true, mode: "live" });
      expect(readiness.publicKey).toMatch(/^[A-Za-z0-9_-]+$/);
    } else {
      expect(readiness).toMatchObject({ ready: false, mode: "setup-pending" });
    }
    expect(JSON.stringify(readiness)).not.toMatch(/privateKey|VAPID_PRIVATE_KEY/i);
  });
});
