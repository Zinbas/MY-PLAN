import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

const publicContext = {
  user: null,
  req: {} as TrpcContext["req"],
  res: {} as TrpcContext["res"],
} satisfies TrpcContext;

describe("secured MY PLAN VAPID configuration", () => {
  it("reports ready through the public reminder-readiness endpoint without serializing the private key", async () => {
    const readiness = await appRouter.createCaller(publicContext).push.readiness();
    expect(readiness).toMatchObject({ ready: true, mode: "live" });
    expect(readiness.publicKey).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(JSON.stringify(readiness)).not.toContain(process.env.VAPID_PRIVATE_KEY!);
  });
});
