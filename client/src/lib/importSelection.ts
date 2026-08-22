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
};

function atImportDate(date: string, time: string) {
  return new Date(`${date}T${time || "09:00"}:00`);
}

export function mapSelectedImportCandidates(selected: SelectedImportCandidate[], timestamp: number) {
  const ready = selected.filter(candidate => isValidImportDate(candidate.date));
  const skipped = selected.length - ready.length;
  const blocks: PlannerBlock[] = ready.filter(candidate => candidate.kind === "block").map((candidate, index) => {
    const startAt = atImportDate(candidate.date, candidate.time);
    return { id: `import-block-${timestamp}-${index}`, title: candidate.title, startAt, endAt: new Date(startAt.getTime() + candidate.durationMinutes * 60_000), source: "planner", priority: "normal", repeat: "none" as RepeatRule, repeatUntil: null, completed: false, checklist: [] };
  });
  const events: PersonalEvent[] = ready.filter(candidate => candidate.kind === "event").map((candidate, index) => {
    const startAt = atImportDate(candidate.date, candidate.time);
    return { id: `import-event-${timestamp}-${index}`, title: candidate.title, startAt, endAt: new Date(startAt.getTime() + candidate.durationMinutes * 60_000), priority: "normal", course: candidate.course || "Imported schedule", notes: candidate.notes };
  });
  const tasks: PlanTask[] = ready.filter(candidate => candidate.kind === "task").map((candidate, index) => {
    const dueAt = atImportDate(candidate.date, candidate.time);
    return { id: `import-task-${timestamp}-${index}`, title: candidate.title, dueAt, priority: "normal", course: candidate.course || "Imported schedule", notes: candidate.notes, completed: false, status: "open" as TaskStatus, createdAt: new Date(timestamp), completedAt: null, scheduledStartAt: candidate.time ? dueAt : null, durationMinutes: candidate.durationMinutes };
  });
  return { ready, skipped, blocks, events, tasks };
}
