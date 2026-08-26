import { BarChart3, BookOpenCheck, CalendarDays, ListTodo, MoreHorizontal, ShieldCheck, UserRound } from "lucide-react";
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
      {!welcomeRetired ? <button className={activeSection === "welcome" ? "active" : ""} aria-current={activeSection === "welcome" ? "page" : undefined} onClick={() => onOpenSection("welcome")}><BookOpenCheck size={17} /> Welcome</button> : null}
      <button className={activeSection === "calendar" ? "active" : ""} aria-current={activeSection === "calendar" ? "page" : undefined} onClick={() => onOpenSection("calendar")}><CalendarDays size={17} /> Calendar</button>
      <button className={activeSection === "todo" ? "active" : ""} aria-current={activeSection === "todo" ? "page" : undefined} onClick={() => onOpenSection("todo")}><ListTodo size={17} /> To-do</button>
      <button className={activeSection === "progress" ? "active" : ""} aria-current={activeSection === "progress" ? "page" : undefined} onClick={() => onOpenSection("progress")}><BarChart3 size={17} /> Progress</button>
      <button className={activeSection === "profile" ? "active" : ""} aria-current={activeSection === "profile" ? "page" : undefined} onClick={() => onOpenSection("profile")}><UserRound size={17} /> Profile</button>
      <button className={isWorkspaceToolsSection(activeSection) ? "active" : ""} aria-current={isWorkspaceToolsSection(activeSection) ? "page" : undefined} onClick={() => onOpenSection("tools")}><MoreHorizontal size={17} /> Workspace tools</button>
      {isAdmin ? <button className={activeSection === "admin" ? "active" : ""} aria-current={activeSection === "admin" ? "page" : undefined} onClick={() => onOpenSection("admin")}><ShieldCheck size={17} /> Admin panel</button> : null}
    </div>
    <div className="side-footer"><ShieldCheck size={15} /><p>{accountStatusCopy(isAuthenticated)}</p></div>
  </aside>;
}
