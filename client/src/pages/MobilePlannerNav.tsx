import { BarChart3, CalendarDays, ListTodo, MoreHorizontal, Plus, UserRound } from "lucide-react";
import { isWorkspaceToolsSection, type PlannerSection } from "@/lib/plannerNavigation";
import "./mobilePlannerNav.css";

type Props = {
  activeSection: PlannerSection;
  onOpen: (section: PlannerSection) => void;
  onPlan: () => void;
};

export default function MobilePlannerNav({ activeSection, onOpen, onPlan }: Props) {
  return <>
    <nav className="mobile-planner-nav" aria-label="Primary mobile navigation">
      <button className={activeSection === "calendar" ? "is-active" : ""} aria-current={activeSection === "calendar" ? "page" : undefined} onClick={() => onOpen("calendar")}>
        <CalendarDays size={18} /><span>Calendar</span>
      </button>
      <button className={activeSection === "todo" ? "is-active" : ""} aria-current={activeSection === "todo" ? "page" : undefined} onClick={() => onOpen("todo")}>
        <ListTodo size={18} /><span>To-do</span>
      </button>
      <button className={activeSection === "progress" ? "is-active" : ""} aria-current={activeSection === "progress" ? "page" : undefined} onClick={() => onOpen("progress")}>
        <BarChart3 size={18} /><span>Progress</span>
      </button>
      <button className={activeSection === "profile" ? "is-active" : ""} aria-current={activeSection === "profile" ? "page" : undefined} onClick={() => onOpen("profile")}>
        <UserRound size={18} /><span>Profile</span>
      </button>
      <button className={isWorkspaceToolsSection(activeSection) ? "is-active" : ""} aria-current={isWorkspaceToolsSection(activeSection) ? "page" : undefined} onClick={() => onOpen("tools")}>
        <MoreHorizontal size={19} /><span>Workspace</span>
      </button>
    </nav>
    <button className="mobile-plan-action" onClick={onPlan} aria-label="Plan on the selected date">
      <Plus size={21} /><span>Plan</span>
    </button>
  </>;
}
