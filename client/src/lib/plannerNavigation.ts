export type PlannerSection = "welcome" | "calendar" | "todo" | "progress" | "tools" | "accounts" | "admin" | "sync" | "import" | "spark" | "reminders";

export function isWorkspaceToolsSection(section: PlannerSection) {
  return section === "tools" || section === "accounts" || section === "sync" || section === "import" || section === "spark" || section === "reminders";
}
