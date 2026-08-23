import { dateKey, isTaskComplete, type PlanTask, type PlannerBlock } from "./ongoingCalendar";
import { workspaceStorageKey } from "./privateWorkspace";

export type NotificationPreferences = { taskDue: boolean; upcomingPlan: boolean };
export type PlanNotification = { id: string; kind: "overdue" | "due-today" | "starting-soon"; title: string; body: string; createdAt: Date; target: "todo" | "calendar" };
type ReadableStorage = Pick<Storage, "getItem">;
type WritableStorage = Pick<Storage, "setItem">;

export const defaultNotificationPreferences: NotificationPreferences = { taskDue: true, upcomingPlan: true };

export function loadNotificationPreferences(storage: ReadableStorage, scope: string): NotificationPreferences {
  try { return { ...defaultNotificationPreferences, ...JSON.parse(storage.getItem(workspaceStorageKey("notification-preferences", scope)) || "{}") }; } catch { return defaultNotificationPreferences; }
}

export function loadReadNotificationIds(storage: ReadableStorage, scope: string): string[] {
  try { const ids = JSON.parse(storage.getItem(workspaceStorageKey("notification-read", scope)) || "[]"); return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : []; } catch { return []; }
}

export function saveReadNotificationIds(storage: WritableStorage, scope: string, ids: string[]) { storage.setItem(workspaceStorageKey("notification-read", scope), JSON.stringify(Array.from(new Set(ids)))); }

export function planningNotifications(tasks: PlanTask[], items: PlannerBlock[], now: Date, preferences: NotificationPreferences): PlanNotification[] {
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due: PlanNotification[] = preferences.taskDue ? tasks.flatMap<PlanNotification>(task => {
    if (isTaskComplete(task)) return [];
    const id = `task-${task.dueAt < startToday ? "overdue" : "due-today"}:${task.id}:${dateKey(task.dueAt)}` as const;
    if (task.dueAt < startToday) return [{ id, kind: "overdue" as const, title: task.title, body: `Overdue since ${dateKey(task.dueAt)} · ${task.course || "MY PLAN task"}`, createdAt: task.dueAt, target: "todo" as const }];
    if (dateKey(task.dueAt) === dateKey(now)) return [{ id, kind: "due-today" as const, title: task.title, body: `Due today · ${task.course || "MY PLAN task"}`, createdAt: task.dueAt, target: "todo" as const }];
    return [];
  }) : [];
  const startingSoon: PlanNotification[] = preferences.upcomingPlan ? items.flatMap<PlanNotification>(item => {
    const minutes = Math.round((item.startAt.getTime() - now.getTime()) / 60_000);
    if (item.source === "academic" || item.completed || minutes < 0 || minutes > 30) return [];
    return [{ id: `start:${item.id}:${item.startAt.getTime()}`, kind: "starting-soon" as const, title: item.title, body: `Starts in ${minutes === 0 ? "less than a minute" : `${minutes} min`} · ${item.course || "MY PLAN"}`, createdAt: item.startAt, target: "calendar" as const }];
  }) : [];
  const order: Record<PlanNotification["kind"], number> = { overdue: 0, "due-today": 1, "starting-soon": 2 };
  return [...due, ...startingSoon].sort((left, right) => order[left.kind] - order[right.kind] || left.createdAt.getTime() - right.createdAt.getTime()).slice(0, 8);
}
