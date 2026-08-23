export type RepeatRule = "none" | "daily" | "weekdays" | "weekly" | "monthly";
export type TaskStatus = "open" | "in-progress" | "done";

export type PlannerBlock = {
  id: string;
  title: string;
  startAt: Date;
  endAt: Date;
  source: "academic" | "planner" | "linked" | "event" | "task";
  priority?: "high" | "normal";
  course?: string;
  notes?: string;
  completed?: boolean;
  repeat?: RepeatRule;
  repeatUntil?: Date | null;
  excludedDates?: string[];
  checklist?: { id: string; label: string; done: boolean }[];
};

export type PersonalEvent = {
  id: string;
  title: string;
  startAt: Date;
  endAt: Date;
  priority: "high" | "normal";
  course: string;
  notes: string;
};

export type PlanTask = {
  id: string;
  title: string;
  dueAt: Date;
  priority: "high" | "normal";
  course: string;
  notes: string;
  completed: boolean;
  scheduledStartAt?: Date | null;
  durationMinutes?: number;
  status?: TaskStatus;
  createdAt?: Date;
  completedAt?: Date | null;
};

export type CalendarItem = PlannerBlock | PersonalEvent | PlanTask;
export type TimeConflict = { item: PlannerBlock; overlapMinutes: number };

export const monthStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
export const addMonths = (date: Date, amount: number) => new Date(date.getFullYear(), date.getMonth() + amount, 1);
export const startOfWeek = (date: Date) => {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  return result;
};
export const addDays = (date: Date, amount: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount, date.getHours(), date.getMinutes());
export const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
export const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const daysInMonth = (cursor: Date) => {
  const first = monthStart(cursor);
  const padding = (first.getDay() + 6) % 7;
  const total = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return Array.from({ length: Math.ceil((padding + total) / 7) * 7 }, (_, index) => index < padding || index >= padding + total ? null : new Date(first.getFullYear(), first.getMonth(), index - padding + 1));
};
export const isWithin = (event: PlannerBlock, start: Date, end: Date) => event.endAt >= start && event.startAt < end;
const rootId = (id: string) => id.split(":")[0];
export const findTimeConflicts = (event: PlannerBlock, allEvents: PlannerBlock[]): TimeConflict[] => allEvents.flatMap(other => {
  if (rootId(other.id) === rootId(event.id) || event.startAt >= other.endAt || event.endAt <= other.startAt) return [];
  const overlapMinutes = Math.max(1, Math.round((Math.min(event.endAt.getTime(), other.endAt.getTime()) - Math.max(event.startAt.getTime(), other.startAt.getTime())) / 60_000));
  return [{ item: other, overlapMinutes }];
});
export const isConflict = (event: PlannerBlock, allEvents: PlannerBlock[]) => findTimeConflicts(event, allEvents).length > 0;

export const isTaskScheduled = (task: PlanTask) => Boolean(task.scheduledStartAt);

export const isTaskComplete = (task: PlanTask) => task.completed || task.status === "done";

export const taskStatus = (task: PlanTask): TaskStatus => {
  if (isTaskComplete(task)) return "done";
  return task.status === "in-progress" ? "in-progress" : "open";
};

export const taskDueState = (task: PlanTask, now = new Date()) => {
  if (isTaskComplete(task)) return "completed" as const;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(task.dueAt.getFullYear(), task.dueAt.getMonth(), task.dueAt.getDate());
  if (due < today) return "overdue" as const;
  if (sameDay(due, today)) return "today" as const;
  return "upcoming" as const;
};

export const taskEndAt = (task: PlanTask) => {
  const start = task.scheduledStartAt ?? task.dueAt;
  return new Date(start.getTime() + (task.durationMinutes ?? 60) * 60 * 1000);
};

export const excludeRecurringDate = (block: PlannerBlock, date: Date): PlannerBlock => ({
  ...block,
  excludedDates: Array.from(new Set([...(block.excludedDates ?? []), dateKey(date)])),
});

export function expandRepeatingBlock(block: PlannerBlock, start: Date, end: Date): PlannerBlock[] {
  const result: PlannerBlock[] = [];
  let cursor = new Date(block.startAt);
  let count = 0;
  const until = block.repeatUntil ?? end;
  while (cursor < end && cursor <= until && count < 600) {
    const duration = block.endAt.getTime() - block.startAt.getTime();
    const occurrence = { ...block, id: `${block.id}:${dateKey(cursor)}`, startAt: new Date(cursor), endAt: new Date(cursor.getTime() + duration) };
    if (isWithin(occurrence, start, end) && !block.excludedDates?.includes(dateKey(cursor))) result.push(occurrence);
    if (block.repeat === "none" || !block.repeat) break;
    if (block.repeat === "daily") cursor = addDays(cursor, 1);
    else if (block.repeat === "weekdays") { cursor = addDays(cursor, 1); while (cursor.getDay() === 0 || cursor.getDay() === 6) cursor = addDays(cursor, 1); }
    else if (block.repeat === "weekly") cursor = addDays(cursor, 7);
    else cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate(), cursor.getHours(), cursor.getMinutes());
    count += 1;
  }
  return result;
}
