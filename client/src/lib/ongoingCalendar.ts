export type RepeatRule = "none" | "daily" | "weekdays" | "weekly" | "monthly";

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
};

export type CalendarItem = PlannerBlock | PersonalEvent | PlanTask;

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
export const isConflict = (event: PlannerBlock, allEvents: PlannerBlock[]) => allEvents.some(other => other.id !== event.id && other.source === "planner" && event.source === "planner" && event.startAt < other.endAt && event.endAt > other.startAt);

export const isTaskScheduled = (task: PlanTask) => Boolean(task.scheduledStartAt);

export const taskEndAt = (task: PlanTask) => {
  const start = task.scheduledStartAt ?? task.dueAt;
  return new Date(start.getTime() + (task.durationMinutes ?? 60) * 60 * 1000);
};

export function expandRepeatingBlock(block: PlannerBlock, start: Date, end: Date): PlannerBlock[] {
  const result: PlannerBlock[] = [];
  let cursor = new Date(block.startAt);
  let count = 0;
  const until = block.repeatUntil ?? end;
  while (cursor < end && cursor <= until && count < 600) {
    const duration = block.endAt.getTime() - block.startAt.getTime();
    const occurrence = { ...block, id: `${block.id}:${dateKey(cursor)}`, startAt: new Date(cursor), endAt: new Date(cursor.getTime() + duration) };
    if (isWithin(occurrence, start, end)) result.push(occurrence);
    if (block.repeat === "none" || !block.repeat) break;
    if (block.repeat === "daily") cursor = addDays(cursor, 1);
    else if (block.repeat === "weekdays") { cursor = addDays(cursor, 1); while (cursor.getDay() === 0 || cursor.getDay() === 6) cursor = addDays(cursor, 1); }
    else if (block.repeat === "weekly") cursor = addDays(cursor, 7);
    else cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate(), cursor.getHours(), cursor.getMinutes());
    count += 1;
  }
  return result;
}
