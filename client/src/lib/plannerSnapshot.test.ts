import { describe, expect, it } from "vitest";
import { decodePlannerSnapshot, encodePlannerSnapshot, mergePlannerSnapshots } from "./plannerSnapshot";

describe("private planner snapshots", () => {
  it("rehydrates private cross-device planner dates without accepting malformed records", () => {
    const snapshot = decodePlannerSnapshot(JSON.stringify({
      blocks: [{ id: "block-1", title: "Read", startAt: "2026-08-27T09:00:00.000Z", endAt: "2026-08-27T10:00:00.000Z", source: "planner" }, { id: "bad", title: "Bad", startAt: "not a date", endAt: "2026-08-27T10:00:00.000Z" }],
      events: [{ id: "event-1", title: "Call", startAt: "2026-08-27T11:00:00.000Z", endAt: "2026-08-27T12:00:00.000Z" }],
      tasks: [{ id: "task-1", title: "Submit", dueAt: "2026-08-28T00:00:00.000Z" }],
    }));

    expect(snapshot.blocks).toHaveLength(1);
    expect(snapshot.blocks[0]?.startAt).toBeInstanceOf(Date);
    expect(snapshot.events[0]?.endAt).toBeInstanceOf(Date);
    expect(snapshot.tasks[0]?.dueAt).toBeInstanceOf(Date);
  });

  it("preserves distinct records from both same-account devices and prefers this device for an edited matching id", () => {
    const remote = decodePlannerSnapshot(JSON.stringify({ blocks: [], events: [{ id: "shared", title: "Remote title", startAt: "2026-08-27T11:00:00.000Z", endAt: "2026-08-27T12:00:00.000Z" }], tasks: [{ id: "remote-task", title: "Remote", dueAt: "2026-08-28T00:00:00.000Z" }] }));
    const local = decodePlannerSnapshot(JSON.stringify({ blocks: [], events: [{ id: "shared", title: "Edited here", startAt: "2026-08-27T11:00:00.000Z", endAt: "2026-08-27T12:00:00.000Z" }, { id: "local-event", title: "Local", startAt: "2026-08-27T13:00:00.000Z", endAt: "2026-08-27T14:00:00.000Z" }], tasks: [] }));

    const merged = mergePlannerSnapshots(remote, local);

    expect(merged.events.map(event => event.id)).toEqual(["shared", "local-event"]);
    expect(merged.events[0]?.title).toBe("Edited here");
    expect(merged.tasks.map(task => task.id)).toEqual(["remote-task"]);
    expect(decodePlannerSnapshot(encodePlannerSnapshot(merged)).events).toHaveLength(2);
  });
});
