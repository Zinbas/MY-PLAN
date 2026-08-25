import { CalendarDays, CirclePlus, ListTodo, MoreHorizontal, SunMedium } from "lucide-react";
import type { MobilePlannerSurface } from "@/lib/mobilePlannerNavigation";

type Props = {
  active: MobilePlannerSurface;
  onNavigate: (surface: MobilePlannerSurface) => void;
  onCapture: () => void;
};

export default function MobilePlannerNav({ active, onNavigate, onCapture }: Props) {
  return <nav className="mobile-planner-nav" aria-label="Mobile planner navigation">
    <button className={active === "today" ? "active" : ""} onClick={() => onNavigate("today")} aria-current={active === "today" ? "page" : undefined}><SunMedium size={18} /><span>Today</span></button>
    <button className={active === "calendar" ? "active" : ""} onClick={() => onNavigate("calendar")} aria-current={active === "calendar" ? "page" : undefined}><CalendarDays size={18} /><span>Calendar</span></button>
    <button className="mobile-capture" onClick={onCapture} aria-label="Add a plan item"><CirclePlus size={27} /><span>Add</span></button>
    <button className={active === "todo" ? "active" : ""} onClick={() => onNavigate("todo")} aria-current={active === "todo" ? "page" : undefined}><ListTodo size={18} /><span>To-do</span></button>
    <button className={active === "more" ? "active" : ""} onClick={() => onNavigate("more")} aria-current={active === "more" ? "page" : undefined}><MoreHorizontal size={19} /><span>More</span></button>
  </nav>;
}

