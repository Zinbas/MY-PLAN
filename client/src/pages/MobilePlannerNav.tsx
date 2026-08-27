import { BellRing, CalendarDays, CirclePlus, ListTodo, MoreHorizontal, SunMedium, UserRound, Wrench } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { isWorkspaceToolsSection, type PlannerSection } from "@/lib/plannerNavigation";
import "./mobilePlannerNav.css";

type Props = {
  activeSection: PlannerSection;
  onOpen: (section: PlannerSection) => void;
  onPlan: () => void;
};

function isMoreSection(section: PlannerSection) {
  return section === "progress" || section === "profile" || isWorkspaceToolsSection(section);
}

export default function MobilePlannerNav({ activeSection, onOpen, onPlan }: Props) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreMenuId = useId();

  useEffect(() => setMoreOpen(false), [activeSection]);

  const openMoreSection = (section: PlannerSection) => {
    setMoreOpen(false);
    onOpen(section);
  };

  return <>
    {moreOpen ? <div className="mobile-more-backdrop" onPointerDown={() => setMoreOpen(false)} /> : null}
    {moreOpen ? <section id={moreMenuId} className="mobile-more-menu" aria-label="More planning destinations">
      <p>More in MY PLAN</p>
      <button className={activeSection === "progress" ? "is-active" : ""} onClick={() => openMoreSection("progress")}><span className="mobile-more-icon"><SunMedium size={17} /></span><span><strong>Progress</strong><small>Review completed work</small></span></button>
      <button className={activeSection === "profile" ? "is-active" : ""} onClick={() => openMoreSection("profile")}><span className="mobile-more-icon"><UserRound size={17} /></span><span><strong>Profile</strong><small>Account and sign-in</small></span></button>
      <button className={isWorkspaceToolsSection(activeSection) ? "is-active" : ""} onClick={() => openMoreSection("tools")}><span className="mobile-more-icon"><Wrench size={17} /></span><span><strong>Workspace</strong><small>Reminders, calendars, and imports</small></span></button>
    </section> : null}
    <nav className="mobile-planner-nav" aria-label="Primary mobile navigation">
      <button className={activeSection === "reminders" ? "is-active" : ""} aria-current={activeSection === "reminders" ? "page" : undefined} onClick={() => onOpen("reminders")}>
        <BellRing size={18} /><span>Reminders</span>
      </button>
      <button className={activeSection === "calendar" ? "is-active" : ""} aria-current={activeSection === "calendar" ? "page" : undefined} onClick={() => onOpen("calendar")}>
        <CalendarDays size={18} /><span>Calendar</span>
      </button>
      <button className="mobile-capture" onClick={onPlan} aria-label="Add a plan item on the selected date">
        <span className="mobile-capture-icon"><CirclePlus size={25} /></span><span>Add</span>
      </button>
      <button className={activeSection === "todo" ? "is-active" : ""} aria-current={activeSection === "todo" ? "page" : undefined} onClick={() => onOpen("todo")}>
        <ListTodo size={18} /><span>To-do</span>
      </button>
      <button className={isMoreSection(activeSection) ? "is-active" : ""} aria-current={isMoreSection(activeSection) ? "page" : undefined} aria-expanded={moreOpen} aria-controls={moreMenuId} onClick={() => setMoreOpen(value => !value)}>
        <MoreHorizontal size={19} /><span>More</span>
      </button>
    </nav>
  </>;
}
