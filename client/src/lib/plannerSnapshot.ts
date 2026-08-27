import type { PersonalEvent, PlannerBlock, PlanTask } from "./ongoingCalendar";
import { mergeWorkspaceItemsById } from "./privateWorkspace";

export type PlannerSnapshot = {
  blocks: PlannerBlock[];
  events: PersonalEvent[];
  tasks: PlanTask[];
};

const emptyPlannerSnapshot = (): PlannerSnapshot => ({ blocks: [], events: [], tasks: [] });

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asDate(value: unknown): Date | null {
  const date = new Date(typeof value === "string" || typeof value === "number" ? value : "");
  return Number.isNaN(date.getTime()) ? null : date;
}

function hasIdentity(value: Record<string, unknown>) {
  return typeof value.id === "string" && value.id.length > 0 && typeof value.title === "string" && value.title.length > 0;
}

function hydrateBlocks(value: unknown): PlannerBlock[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    const record = asRecord(item);
    const startAt = record ? asDate(record.startAt) : null;
    const endAt = record ? asDate(record.endAt) : null;
    if (!record || !hasIdentity(record) || !startAt || !endAt) return [];
    const repeatUntil = record.repeatUntil ? asDate(record.repeatUntil) : null;
    return [{ ...record, startAt, endAt, repeatUntil } as PlannerBlock];
  });
}

function hydrateEvents(value: unknown): PersonalEvent[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    const record = asRecord(item);
    const startAt = record ? asDate(record.startAt) : null;
    const endAt = record ? asDate(record.endAt) : null;
    if (!record || !hasIdentity(record) || !startAt || !endAt) return [];
    return [{ ...record, startAt, endAt } as PersonalEvent];
  });
}

function hydrateTasks(value: unknown): PlanTask[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    const record = asRecord(item);
    const dueAt = record ? asDate(record.dueAt) : null;
    if (!record || !hasIdentity(record) || !dueAt) return [];
    const scheduledStartAt = record.scheduledStartAt ? asDate(record.scheduledStartAt) : null;
    const createdAt = record.createdAt ? asDate(record.createdAt) : new Date();
    const completedAt = record.completedAt ? asDate(record.completedAt) : null;
    return [{ ...record, dueAt, scheduledStartAt, createdAt, completedAt } as PlanTask];
  });
}

export function decodePlannerSnapshot(payload: string | null | undefined): PlannerSnapshot {
  if (!payload) return emptyPlannerSnapshot();
  try {
    const record = asRecord(JSON.parse(payload));
    if (!record) return emptyPlannerSnapshot();
    return { blocks: hydrateBlocks(record.blocks), events: hydrateEvents(record.events), tasks: hydrateTasks(record.tasks) };
  } catch {
    return emptyPlannerSnapshot();
  }
}

export function encodePlannerSnapshot(snapshot: PlannerSnapshot) {
  return JSON.stringify(snapshot);
}

/** Remote records come first; this device's unsynced records win only for matching ids. */
export function mergePlannerSnapshots(remote: PlannerSnapshot, local: PlannerSnapshot): PlannerSnapshot {
  return {
    blocks: mergeWorkspaceItemsById(remote.blocks, local.blocks),
    events: mergeWorkspaceItemsById(remote.events, local.events),
    tasks: mergeWorkspaceItemsById(remote.tasks, local.tasks),
  };
}
