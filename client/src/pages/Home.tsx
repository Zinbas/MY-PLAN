/**
 * Design: Paper Field Notes — warm ivory editorial calendar, terracotta critical dates,
 * muted olive recovery periods, generous whitespace, and an asymmetric calendar/agenda layout.
 */
import { useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  ListChecks,
  Sparkles,
} from "lucide-react";

type Category = "critical" | "quiz" | "recovery" | "attendance" | "practical";

type AcademicEvent = {
  id: string;
  title: string;
  category: Category;
  dates: string[];
};

const YEAR = 2026;
const MONTHS = [
  "August 2026",
  "September 2026",
  "October 2026",
  "November 2026",
  "December 2026",
];
const MONTH_INDICES = [7, 8, 9, 10, 11];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const dateKey = (month: number, day: number) =>
  `${YEAR}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

const rangeKeys = (startMonth: number, startDay: number, endMonth: number, endDay: number) => {
  const dates: string[] = [];
  const current = new Date(YEAR, startMonth, startDay);
  const end = new Date(YEAR, endMonth, endDay);
  while (current <= end) {
    dates.push(dateKey(current.getMonth(), current.getDate()));
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

const events: AcademicEvent[] = [
  { id: "assignment", title: "Assignment Submission - I", category: "critical", dates: [dateKey(7, 12)] },
  { id: "java-quiz", title: "Java 1st Quiz", category: "quiz", dates: [dateKey(7, 17)] },
  { id: "attendance", title: "Attendance Monitoring - I", category: "attendance", dates: [dateKey(7, 22)] },
  { id: "janmashtami", title: "Janmashtami Holiday Break", category: "recovery", dates: rangeKeys(7, 28, 7, 30) },
  { id: "quiz-window", title: "Quiz 1 Window (Units I & II)", category: "quiz", dates: rangeKeys(8, 11, 8, 15) },
  { id: "sessional-one", title: "SESSIONAL I EXAMINATIONS", category: "critical", dates: rangeKeys(8, 16, 8, 21) },
  { id: "recovery", title: "Post-Sessional Recovery Break", category: "recovery", dates: rangeKeys(8, 22, 8, 24) },
  { id: "sessional-two", title: "SESSIONAL II EXAMINATIONS", category: "critical", dates: rangeKeys(9, 22, 9, 28) },
  { id: "practicals", title: "Practical Examinations (Final Lab Evaluations)", category: "practical", dates: rangeKeys(10, 16, 10, 20) },
  { id: "last-day", title: "Last Day of College Lectures", category: "attendance", dates: [dateKey(10, 20)] },
  { id: "end-sem", title: "END SEMESTER THEORY EXAMS", category: "critical", dates: rangeKeys(10, 25, 11, 15) },
];

const monthNotes: Record<number, string[]> = {
  9: ["Late Oct: Diwali Holiday Break"],
};

const categoryLabel: Record<Category, string> = {
  critical: "Critical date",
  quiz: "Quiz window",
  recovery: "Recovery period",
  attendance: "Academic check",
  practical: "Practical examination",
};

function getCalendarDays(month: number) {
  const firstDay = new Date(YEAR, month, 1).getDay();
  const mondayIndex = (firstDay + 6) % 7;
  const daysInMonth = new Date(YEAR, month + 1, 0).getDate();
  return Array.from({ length: mondayIndex + daysInMonth }, (_, index) =>
    index < mondayIndex ? null : index - mondayIndex + 1,
  );
}

function formatSelectedDate(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

export default function Home() {
  const [activeMonthIndex, setActiveMonthIndex] = useState(0);
  const activeMonth = MONTH_INDICES[activeMonthIndex];
  const [selectedDate, setSelectedDate] = useState(dateKey(7, 12));

  const calendarDays = useMemo(() => getCalendarDays(activeMonth), [activeMonth]);
  const visibleEvents = useMemo(
    () =>
      events.filter((event) =>
        event.dates.some((date) => date.startsWith(`${YEAR}-${String(activeMonth + 1).padStart(2, "0")}`)),
      ),
    [activeMonth],
  );
  const selectedEvents = events.filter((event) => event.dates.includes(selectedDate));

  const chooseMonth = (index: number) => {
    setActiveMonthIndex(index);
    setSelectedDate(dateKey(MONTH_INDICES[index], 1));
  };

  const changeMonth = (direction: number) => {
    const nextIndex = Math.min(Math.max(activeMonthIndex + direction, 0), MONTHS.length - 1);
    chooseMonth(nextIndex);
  };

  return (
    <div className="calendar-app">
      <aside className="semester-rail" aria-label="Semester navigation">
        <div className="brand-lockup">
          <img src="/manus-storage/academic-calendar-logo_525d2637.png" alt="Academic calendar mark" className="brand-mark" />
          <div>
            <p className="brand-kicker">Academic year</p>
            <p className="brand-name">MY PLAN</p>
          </div>
        </div>

        <div className="rail-rule" />
        <p className="rail-label">Semester view</p>
        <nav className="month-stack" aria-label="Calendar months">
          {MONTHS.map((month, index) => (
            <button
              key={month}
              className={`month-stack-button ${index === activeMonthIndex ? "is-active" : ""}`}
              onClick={() => chooseMonth(index)}
              aria-pressed={index === activeMonthIndex}
            >
              <span>{String(index + 8).padStart(2, "0")}</span>
              {month.split(" ")[0]}
            </button>
          ))}
        </nav>

        <div className="rail-note">
          <Sparkles size={16} strokeWidth={1.8} />
          <p>Select a marked date to see what matters.</p>
        </div>
      </aside>

      <main className="calendar-main">
        <section className="hero-panel">
          <img src="/manus-storage/academic-calendar-paper-hero_f8a20734.png" alt="" className="hero-art" />
          <div className="hero-copy">
            <div className="eyebrow-row">
              <CalendarDays size={15} />
              <span>August — December 2026</span>
            </div>
            <h1>The semester,<br />in one view.</h1>
            <p>Key assignments, examination windows, practicals, and recovery periods from your 10-week academic turnaround plan.</p>
          </div>
          <div className="hero-stamp">
            <span>5</span>
            <p>months<br />mapped</p>
          </div>
        </section>

        <section className="calendar-workspace" aria-label="Interactive academic calendar">
          <div className="workspace-tools">
            <div className="mobile-brand"><img src="/manus-storage/academic-calendar-logo_525d2637.png" alt="" /> MY PLAN</div>
            <div className="month-nav" aria-label="Month controls">
              <button onClick={() => changeMonth(-1)} disabled={activeMonthIndex === 0} aria-label="Previous month"><ChevronLeft size={19} /></button>
              <h2>{MONTHS[activeMonthIndex]}</h2>
              <button onClick={() => changeMonth(1)} disabled={activeMonthIndex === MONTHS.length - 1} aria-label="Next month"><ChevronRight size={19} /></button>
            </div>
            <div className="month-pills" aria-label="Jump to month">
              {MONTHS.map((month, index) => (
                <button
                  key={month}
                  onClick={() => chooseMonth(index)}
                  className={index === activeMonthIndex ? "is-active" : ""}
                  aria-pressed={index === activeMonthIndex}
                >
                  {month.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          <div className="workspace-grid">
            <section className="calendar-surface">
              <div className="weekday-row">
                {WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}
              </div>
              <div className="date-grid">
                {calendarDays.map((day, index) => {
                  if (!day) return <div key={`blank-${index}`} className="date-cell date-cell--blank" aria-hidden="true" />;
                  const key = dateKey(activeMonth, day);
                  const dayEvents = events.filter((event) => event.dates.includes(key));
                  const primaryCategory = dayEvents[0]?.category;
                  const isSelected = key === selectedDate;
                  return (
                    <button
                      key={key}
                      className={`date-cell ${dayEvents.length ? "has-event" : ""} ${isSelected ? "is-selected" : ""} ${primaryCategory ? `category-${primaryCategory}` : ""}`}
                      onClick={() => setSelectedDate(key)}
                      aria-label={`${formatSelectedDate(key)}${dayEvents.length ? `, ${dayEvents.map((event) => event.title).join(", ")}` : ""}`}
                    >
                      <span className="date-number">{day}</span>
                      {dayEvents.length > 0 && <span className="event-dots" aria-hidden="true">{dayEvents.slice(0, 3).map((event) => <i key={event.id} className={`dot dot-${event.category}`} />)}</span>}
                    </button>
                  );
                })}
              </div>
              <div className="calendar-legend" aria-label="Calendar legend">
                <span><i className="dot dot-critical" />Critical</span>
                <span><i className="dot dot-quiz" />Quiz</span>
                <span><i className="dot dot-practical" />Practical</span>
                <span><i className="dot dot-recovery" />Recovery</span>
              </div>
            </section>

            <aside className="agenda-panel">
              <div className="agenda-tab-motif" aria-hidden="true"><i /><i /><i /><span /></div>
              <div className="agenda-content">
                <p className="agenda-label"><CircleDot size={14} /> Selected day</p>
                <h3>{formatSelectedDate(selectedDate)}</h3>
                {selectedEvents.length > 0 ? (
                  <div className="selected-event-list">
                    {selectedEvents.map((event) => (
                      <article key={event.id} className={`selected-event event-${event.category}`}>
                        <span>{categoryLabel[event.category]}</span>
                        <strong>{event.title}</strong>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="empty-selection">No key academic date is marked for this day.</p>
                )}

                <div className="agenda-rule" />
                <p className="agenda-label"><ListChecks size={14} /> This month</p>
                <div className="month-event-list">
                  {visibleEvents.map((event) => (
                    <button key={event.id} className="month-event" onClick={() => setSelectedDate(event.dates.find((date) => date.startsWith(`${YEAR}-${String(activeMonth + 1).padStart(2, "0")}`)) || selectedDate)}>
                      <i className={`dot dot-${event.category}`} />
                      <span>{event.title}</span>
                      <ArrowRight size={14} />
                    </button>
                  ))}
                </div>
                {monthNotes[activeMonth]?.length ? (
                  <div className="month-notes">
                    {monthNotes[activeMonth].map((note) => <p key={note}>{note}</p>)}
                  </div>
                ) : null}
              </div>
            </aside>
          </div>
        </section>

        <section className="mobile-accent-card">
          <img src="/manus-storage/academic-calendar-mobile-accent_591abfc5.png" alt="" />
          <div><p>Keep the rhythm</p><span>Lectures, sprints, recovery, repeat.</span></div>
        </section>
      </main>
    </div>
  );
}
