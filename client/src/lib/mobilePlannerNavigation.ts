import type { PlannerSection } from "./plannerNavigation";

export type MobilePlannerSurface = "today" | "calendar" | "todo" | "more";

export const mobilePlannerDestinations: ReadonlyArray<{ surface: MobilePlannerSurface; label: string; section: PlannerSection }> = [
  { surface: "today", label: "Today", section: "calendar" },
  { surface: "calendar", label: "Calendar", section: "calendar" },
  { surface: "todo", label: "To-do", section: "todo" },
  { surface: "more", label: "More", section: "tools" },
];

export function mobileSurfaceFor(section: PlannerSection): MobilePlannerSurface {
  if (section === "todo") return "todo";
  if (section === "calendar") return "today";
  if (section === "tools" || section === "accounts" || section === "sync" || section === "import" || section === "spark" || section === "reminders") return "more";
  return "today";
}
