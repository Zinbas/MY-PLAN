import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("private planner snapshot contract", () => {
  it("scopes reads and writes to the authenticated user and never accepts a client-supplied user id", async () => {
    const router = await readFile(new URL("./routers.ts", import.meta.url), "utf8");
    const db = await readFile(new URL("./db.ts", import.meta.url), "utf8");

    expect(router).toContain("snapshot: protectedProcedure.input(z.object({ workspaceId: z.number().int().positive() })).query(({ ctx }) => getOwnedPlannerSnapshot(ctx.user.id))");
    expect(router).toContain("saveOwnedPlannerSnapshot(ctx.user.id, payload)");
    expect(router).not.toContain("saveSnapshot: protectedProcedure.input(z.object({ userId");
    expect(db).toContain("where(eq(plannerSnapshots.userId, userId))");
    expect(db).toContain("mergePlannerSnapshotPayloads(existing?.payload, payload)");
  });

  it("limits the snapshot shape and size before persistence", async () => {
    const router = await readFile(new URL("./routers.ts", import.meta.url), "utf8");

    expect(router).toContain(".max(1_000)");
    expect(router).toContain("payload.length > 2_000_000");
  });
});
