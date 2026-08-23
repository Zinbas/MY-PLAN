import { addDays, isTaskComplete, type PlannerBlock, type PlanTask, sameDay } from "./ongoingCalendar";

export type TodoSort = "due" | "priority" | "newest";

export type WeekActivity = {
  date: Date;
  completedTasks: number;
  focusMinutes: number;
};

const dayStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export function sortTodoTasks(tasks: PlanTask[], sort: TodoSort) {
  return [...tasks].sort((a, b) => {
    const completeOrder = Number(isTaskComplete(a)) - Number(isTaskComplete(b));
    if (completeOrder) return completeOrder;
    if (sort === "priority") {
      const priorityOrder = Number(b.priority === "high") - Number(a.priority === "high");
      if (priorityOrder) return priorityOrder;
    }
    if (sort === "newest") return (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0);
    return a.dueAt.getTime() - b.dueAt.getTime();
  });
}

export function weeklyActivity(tasks: PlanTask[], blocks: PlannerBlock[], now = new Date()): WeekActivity[] {
  const today = dayStart(now);
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(today, index - 6);
    const completedTasks = tasks.filter(task => isTaskComplete(task) && task.completedAt && sameDay(task.completedAt, date)).length;
    const focusMinutes = blocks.filter(block => block.completed && sameDay(block.startAt, date)).reduce((total, block) => total + Math.max(0, Math.round((block.endAt.getTime() - block.startAt.getTime()) / 60_000)), 0);
    return { date, completedTasks, focusMinutes };
  });
}

export function onTimeCompletionStats(tasks: PlanTask[]) {
  const timestamped = tasks.filter(task => isTaskComplete(task) && task.completedAt);
  const onTime = timestamped.filter(task => task.completedAt!.getTime() <= task.dueAt.getTime());
  return { onTime: onTime.length, timestamped: timestamped.length };
}

export function recentCompletedTasks(tasks: PlanTask[], limit = 5) {
  return tasks.filter(task => isTaskComplete(task) && task.completedAt).sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime()).slice(0, limit);
}
