import { addDays, expandRepeatingBlock, isTaskComplete, type PersonalEvent, type PlannerBlock, type PlanTask } from "./ongoingCalendar";

export type PersonalReminderCandidate = {
  sourceKind: "task" | "event" | "block";
  sourceId: string;
  title: string;
  body: string;
  targetSection: "calendar" | "todo";
  occursAt: Date;
};

export const PERSONAL_REMINDER_HORIZON_DAYS = 120;

/** Builds a title-and-time-only enrollment payload. Notes, courses, checklists, and other workspace details never leave the browser here. */
export function personalReminderCandidates(input: {
  tasks: PlanTask[];
  events: PersonalEvent[];
  blocks: PlannerBlock[];
  now: Date;
  horizonDays?: number;
}): PersonalReminderCandidate[] {
  const horizon = addDays(input.now, input.horizonDays ?? PERSONAL_REMINDER_HORIZON_DAYS);
  const inHorizon = (date: Date) => date > input.now && date <= horizon;
  const candidates: PersonalReminderCandidate[] = [
    ...input.tasks.filter(task => !isTaskComplete(task) && inHorizon(task.scheduledStartAt ?? task.dueAt)).map(task => ({
      sourceKind: "task" as const,
      sourceId: task.id,
      title: task.title,
      body: task.scheduledStartAt ? "Scheduled task starts" : "Task due",
      targetSection: "todo" as const,
      occursAt: task.scheduledStartAt ?? task.dueAt,
    })),
    ...input.events.filter(event => inHorizon(event.startAt)).map(event => ({
      sourceKind: "event" as const,
      sourceId: event.id,
      title: event.title,
      body: "Personal event starts",
      targetSection: "calendar" as const,
      occursAt: event.startAt,
    })),
    ...input.blocks.filter(block => !block.completed).flatMap(block => {
      const instances = block.repeat && block.repeat !== "none" ? expandRepeatingBlock(block, input.now, horizon) : [block];
      return instances.filter(instance => inHorizon(instance.startAt)).map(instance => ({
        sourceKind: "block" as const,
        sourceId: `${block.id.split(":")[0]}:${instance.startAt.getTime()}`,
        title: instance.title,
        body: "Focus block starts",
        targetSection: "calendar" as const,
        occursAt: instance.startAt,
      }));
    }),
  ];
  return candidates.sort((a, b) => a.occursAt.getTime() - b.occursAt.getTime());
}
