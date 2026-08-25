import { BarChart3, BookOpenCheck, CalendarDays, ListTodo, MoreHorizontal, ShieldCheck } from "lucide-react";
import { accountStatusCopy } from "@/lib/accountStatusCopy";
import { isWorkspaceToolsSection, type PlannerSection } from "@/lib/plannerNavigation";

const MY_PLAN_LOGO_URL = "/manus-storage/my-plan-note-mark_567e5611.jpg";

type Props = {
  activeSection: PlannerSection;
  isAdmin: boolean;
  isAuthenticated: boolean;
  isCollapsed: boolean;
  isOpen: boolean;
  welcomeRetired: boolean;
  onOpenSection: (section: PlannerSection) => void;
  onReturnHome: () => void;
};

export default function PlannerSidebar({ activeSection, isAdmin, isAuthenticated, isCollapsed, isOpen, welcomeRetired, onOpenSection, onReturnHome }: Props) {
  return <aside className={`ongoing-sidebar ${isOpen ? "is-open" : ""} ${isCollapsed ? "is-collapsed" : ""}`}>
    <button className="brand-line" onClick={onReturnHome} aria-label="Return to MY PLAN home"><div className="tab-mark"><img src={MY_PLAN_LOGO_URL} alt="" /></div><div><span>Your clear plan</span><strong>MY PLAN</strong></div></button>
    <div className="side-nav">
      {!welcomeRetired ? <button className={activeSection === "welcome" ? "active" : ""} onClick={() => onOpenSection("welcome")}><BookOpenCheck size={17} /> Welcome</button> : null}
      <button className={activeSection === "calendar" ? "active" : ""} onClick={() => onOpenSection("calendar")}><CalendarDays size={17} /> Calendar</button>
      <button className={activeSection === "todo" ? "active" : ""} onClick={() => onOpenSection("todo")}><ListTodo size={17} /> To-do</button>
      <button className={activeSection === "progress" ? "active" : ""} onClick={() => onOpenSection("progress")}><BarChart3 size={17} /> Progress</button>
      <button className={isWorkspaceToolsSection(activeSection) ? "active" : ""} onClick={() => onOpenSection("tools")}><MoreHorizontal size={17} /> Workspace tools</button>
      {isAdmin ? <button className={activeSection === "admin" ? "active" : ""} onClick={() => onOpenSection("admin")}><ShieldCheck size={17} /> Admin panel</button> : null}
    </div>
    <div className="side-footer"><ShieldCheck size={15} /><p>{accountStatusCopy(isAuthenticated)}</p></div>
  </aside>;
}
