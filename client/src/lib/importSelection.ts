import type { PersonalEvent, PlannerBlock, PlanTask, RepeatRule, TaskStatus } from "./ongoingCalendar";
import { isValidImportDate } from "./importDates";

export type SelectedImportCandidate = {
  id: string;
  title: string;
  kind: "block" | "event" | "task";
  date: string;
  time: string;
  durationMinutes: number;
  course: string;
  notes: string;
  weekdays?: number[];
  repeatUntil?: string;
};

function atImportDate(date: string, time: string) {
  return new Date(`${date}T${time || "09:00"}:00`);
}

function firstWeeklyOccurrence(date: string, time: string, weekday?: number) {
  const startAt = atImportDate(date, time);
  if (weekday == null) return startAt;
  startAt.setDate(startAt.getDate() + ((weekday - startAt.getDay() + 7) % 7));
  return startAt;
}

export function mapSelectedImportCandidates(selected: SelectedImportCandidate[], timestamp: number, weeklyRepeatUntil?: string) {
  const ready = selected.filter(candidate => isValidImportDate(candidate.date));
  const skipped = selected.length - ready.length;
  const blocks: PlannerBlock[] = ready.filter(candidate => candidate.kind === "block" || Boolean(candidate.weekdays?.length)).map((candidate, index) => {
    const weeklyDay = candidate.weekdays?.[0];
    const startAt = firstWeeklyOccurrence(candidate.date, candidate.time, weeklyDay);
    const candidateRepeatUntil = candidate.repeatUntil || weeklyRepeatUntil;
    const repeatUntil = weeklyDay == null || !isValidImportDate(candidateRepeatUntil || "") ? null : atImportDate(candidateRepeatUntil!, "23:59");
    return { id: `import-block-${timestamp}-${index}`, title: candidate.title, startAt, endAt: new Date(startAt.getTime() + candidate.durationMinutes * 60_000), source: "planner", priority: "normal", repeat: weeklyDay == null ? "none" as RepeatRule : "weekly" as RepeatRule, repeatUntil, completed: false, checklist: [] };
  });
  const events: PersonalEvent[] = ready.filter(candidate => candidate.kind === "event" && !candidate.weekdays?.length).map((candidate, index) => {
    const startAt = atImportDate(candidate.date, candidate.time);
    return { id: `import-event-${timestamp}-${index}`, title: candidate.title, startAt, endAt: new Date(startAt.getTime() + candidate.durationMinutes * 60_000), priority: "normal", course: candidate.course || "Imported schedule", notes: candidate.notes };
  });
  const tasks: PlanTask[] = ready.filter(candidate => candidate.kind === "task").map((candidate, index) => {
    const dueAt = atImportDate(candidate.date, candidate.time);
    return { id: `import-task-${timestamp}-${index}`, title: candidate.title, dueAt, priority: "normal", course: candidate.course || "Imported schedule", notes: candidate.notes, completed: false, status: "open" as TaskStatus, createdAt: new Date(timestamp), completedAt: null, scheduledStartAt: candidate.time ? dueAt : null, durationMinutes: candidate.durationMinutes };
  });
  return { ready, skipped, blocks, events, tasks };
}

export function firstImportedCalendarDate({ blocks, events, tasks }: Pick<ReturnType<typeof mapSelectedImportCandidates>, "blocks" | "events" | "tasks">) {
  const dates = [
    ...blocks.map(block => block.startAt),
    ...events.map(event => event.startAt),
    ...tasks.map(task => task.scheduledStartAt ?? task.dueAt),
  ].filter(date => !Number.isNaN(date.getTime()));

  if (!dates.length) return null;
  return new Date(Math.min(...dates.map(date => date.getTime())));
}
