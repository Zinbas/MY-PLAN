import { isTaskComplete, type PlanTask } from "./ongoingCalendar";

export type DeadlineCue = {
  course: string;
  title: string;
  dueAt: Date;
  daysAway: number;
};

export function deadlineCues(tasks: PlanTask[], now: Date, limit = 3): DeadlineCue[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const latest = today + 14 * 24 * 60 * 60 * 1000;
  const firstByCourse = new Map<string, PlanTask>();

  tasks
    .filter(task => !isTaskComplete(task) && task.dueAt.getTime() <= latest)
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
    .forEach(task => {
      const course = task.course?.trim() || "General";
      if (!firstByCourse.has(course)) firstByCourse.set(course, task);
    });

  return Array.from(firstByCourse.entries()).slice(0, limit).map(([course, task]) => ({
    course,
    title: task.title,
    dueAt: task.dueAt,
    daysAway: Math.round((new Date(task.dueAt.getFullYear(), task.dueAt.getMonth(), task.dueAt.getDate()).getTime() - today) / 86_400_000),
  }));
}

export function deadlineLabel(daysAway: number) {
  if (daysAway < 0) return `${Math.abs(daysAway)}d overdue`;
  if (daysAway === 0) return "due today";
  if (daysAway === 1) return "due tomorrow";
  return `due in ${daysAway}d`;
}
