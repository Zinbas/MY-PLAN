import type { PersonalEvent, PlannerBlock, PlanTask, TaskStatus } from "./ongoingCalendar";
import { workspaceStorageKey } from "./privateWorkspace";

type ReadableStorage = Pick<Storage, "getItem">;

const readJson = <T>(storage: ReadableStorage, key: string): T[] => {
  try { const value = JSON.parse(storage.getItem(key) || "[]"); return Array.isArray(value) ? value : []; } catch { return []; }
};

export const loadScopedBlocks = (storage: ReadableStorage, scope: string): PlannerBlock[] => readJson<PlannerBlock>(storage, workspaceStorageKey("blocks", scope)).map(block => ({ ...block, startAt: new Date(block.startAt), endAt: new Date(block.endAt), repeatUntil: block.repeatUntil ? new Date(block.repeatUntil) : null }));
export const loadScopedEvents = (storage: ReadableStorage, scope: string): PersonalEvent[] => readJson<PersonalEvent>(storage, workspaceStorageKey("events", scope)).map(event => ({ ...event, startAt: new Date(event.startAt), endAt: new Date(event.endAt) }));
export const loadScopedTasks = (storage: ReadableStorage, scope: string): PlanTask[] => readJson<PlanTask>(storage, workspaceStorageKey("tasks", scope)).map(task => ({ ...task, dueAt: new Date(task.dueAt), scheduledStartAt: task.scheduledStartAt ? new Date(task.scheduledStartAt) : null, createdAt: task.createdAt ? new Date(task.createdAt) : new Date(), completedAt: task.completedAt ? new Date(task.completedAt) : null, status: task.completed || task.status === "done" ? "done" : (task.status ?? "open") as TaskStatus }));
