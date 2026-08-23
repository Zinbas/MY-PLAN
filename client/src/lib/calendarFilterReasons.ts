import type { PlannerBlock, TaskStatus } from "./ongoingCalendar";

export type CalendarFilterState = {
  source: "all" | PlannerBlock["source"];
  itemType: "all" | "event" | "planner" | "task";
  scheduleHealth: "all" | "conflicts" | "clear";
  priority: "all" | "high";
  routine: "all" | "one-time" | "recurring";
  taskStatus: "all" | TaskStatus | "completed";
  course: string;
};

const sourceLabels: Record<PlannerBlock["source"], string> = { academic: "Academic", planner: "Focus block", event: "My event", task: "Scheduled task", linked: "Linked calendar" };

export function calendarFilterReasons(event: PlannerBlock, filters: CalendarFilterState, conflictCount: number, taskState?: TaskStatus) {
  const reasons: string[] = [];
  if (filters.source !== "all") reasons.push(sourceLabels[filters.source]);
  if (filters.itemType !== "all" && filters.itemType !== filters.source) reasons.push(filters.itemType === "planner" ? "Focus block" : filters.itemType === "task" ? "Scheduled task" : "Event");
  if (filters.scheduleHealth === "conflicts") reasons.push("Has overlap");
  if (filters.scheduleHealth === "clear") reasons.push("No overlaps");
  if (filters.priority === "high") reasons.push("High priority");
  if (filters.routine === "recurring") reasons.push("Recurring");
  if (filters.routine === "one-time") reasons.push("One-time");
  if (event.source === "task" && filters.taskStatus !== "all" && taskState) reasons.push(taskState === "in-progress" ? "In progress" : taskState === "done" || filters.taskStatus === "completed" ? "Completed" : "Open");
  if (filters.course !== "All courses / lists") reasons.push(filters.course);
  return Array.from(new Set(reasons));
}
