/**
 * Design: Paper Field Notes — a mobile-first academic calendar workspace with a warm editorial
 * palette, fine notebook rules, and visibly labeled demo states for external integrations.
 */
import { useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  CloudCog,
  Copy,
  ExternalLink,
  GraduationCap,
  ListChecks,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";

type Category = "critical" | "quiz" | "recovery" | "attendance" | "practical" | "focus";
type Section = "calendar" | "accounts" | "sync" | "spark";

type CalendarItem = {
  id: string;
  title: string;
  category: Category;
  date: string;
  time?: string;
  source?: string;
};

type DemoConnection = {
  id: string;
  email: string;
  kind: "Google" | "Workspace" | "Demo";
  calendarCount: number;
  status: "Connected" | "Ready to activate" | "Demo";
  lastSync: string;
};

const YEAR = 2026;
const MONTHS = ["August 2026", "September 2026", "October 2026", "November 2026", "December 2026"];
const MONTH_INDICES = [7, 8, 9, 10, 11];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const dateKey = (month: number, day: number) => `${YEAR}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
const rangeKeys = (startMonth: number, startDay: number, endMonth: number, endDay: number) => {
  const dates: string[] = [];
  const cursor = new Date(YEAR, startMonth, startDay);
  const end = new Date(YEAR, endMonth, endDay);
  while (cursor <= end) {
    dates.push(dateKey(cursor.getMonth(), cursor.getDate()));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
};

const scheduleItems: CalendarItem[] = [
  { id: "assignment", title: "Assignment Submission - I", category: "critical", date: dateKey(7, 12), time: "5:00 PM", source: "Academic plan" },
  { id: "java-quiz", title: "Java 1st Quiz", category: "quiz", date: dateKey(7, 17), time: "10:00 AM", source: "Academic plan" },
  { id: "attendance", title: "Attendance Monitoring - I", category: "attendance", date: dateKey(7, 22), source: "Academic plan" },
  ...rangeKeys(7, 28, 7, 30).map((date, index) => ({ id: `holiday-${index}`, title: "Janmashtami Holiday Break", category: "recovery" as const, date, source: "Academic plan" })),
  ...rangeKeys(8, 11, 8, 15).map((date, index) => ({ id: `quiz-window-${index}`, title: "Quiz 1 Window (Units I & II)", category: "quiz" as const, date, source: "Academic plan" })),
  ...rangeKeys(8, 16, 8, 21).map((date, index) => ({ id: `sessional-one-${index}`, title: "SESSIONAL I EXAMINATIONS", category: "critical" as const, date, source: "Academic plan" })),
  ...rangeKeys(8, 22, 8, 24).map((date, index) => ({ id: `recovery-${index}`, title: "Post-Sessional Recovery Break", category: "recovery" as const, date, source: "Academic plan" })),
  ...rangeKeys(9, 22, 9, 28).map((date, index) => ({ id: `sessional-two-${index}`, title: "SESSIONAL II EXAMINATIONS", category: "critical" as const, date, source: "Academic plan" })),
  ...rangeKeys(10, 16, 10, 20).map((date, index) => ({ id: `practical-${index}`, title: "Practical Examinations", category: "practical" as const, date, source: "Academic plan" })),
  { id: "last-day", title: "Last Day of College Lectures", category: "attendance", date: dateKey(10, 20), source: "Academic plan" },
  ...rangeKeys(10, 25, 11, 15).map((date, index) => ({ id: `end-sem-${index}`, title: "END SEMESTER THEORY EXAMS", category: "critical" as const, date, source: "Academic plan" })),
];

const initialConnections: DemoConnection[] = [
  { id: "personal", email: "your.name@gmail.com", kind: "Demo", calendarCount: 3, status: "Demo", lastSync: "Local sample data" },
  { id: "workspace", email: "you@university.edu", kind: "Workspace", calendarCount: 2, status: "Ready to activate", lastSync: "Awaiting OAuth" },
];

const categoryLabel: Record<Category, string> = { critical: "Critical", quiz: "Quiz", recovery: "Recovery", attendance: "Academic check", practical: "Practical", focus: "Focus block" };

function getCalendarDays(month: number) {
  const mondayIndex = (new Date(YEAR, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(YEAR, month + 1, 0).getDate();
  return Array.from({ length: mondayIndex + daysInMonth }, (_, index) => index < mondayIndex ? null : index - mondayIndex + 1);
}

function formatDate(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date(year, month - 1, day));
}

function PanelButton({ section, active, icon: Icon, label, onClick }: { section: Section; active: Section; icon: typeof CalendarDays; label: string; onClick: () => void }) {
  return <button className={`rail-action ${section === active ? "is-active" : ""}`} onClick={onClick}><Icon size={17} /><span>{label}</span></button>;
}

export default function Home() {
  const [activeMonthIndex, setActiveMonthIndex] = useState(0);
  const [activeSection, setActiveSection] = useState<Section>("calendar");
  const [selectedDate, setSelectedDate] = useState(dateKey(7, 12));
  const [connections, setConnections] = useState(initialConnections);
  const [customItems, setCustomItems] = useState<CalendarItem[]>([]);
  const [showComposer, setShowComposer] = useState(false);
  const [showAccountSheet, setShowAccountSheet] = useState(false);
  const [toast, setToast] = useState("Demo mode is active. Your real Google credentials can be added later.");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftTime, setDraftTime] = useState("07:00 PM");
  const [draftCategory, setDraftCategory] = useState<Category>("focus");

  const activeMonth = MONTH_INDICES[activeMonthIndex];
  const allItems = useMemo(() => [...scheduleItems, ...customItems], [customItems]);
  const calendarDays = useMemo(() => getCalendarDays(activeMonth), [activeMonth]);
  const selectedItems = allItems.filter(item => item.date === selectedDate);
  const monthItems = allItems.filter(item => item.date.startsWith(`${YEAR}-${String(activeMonth + 1).padStart(2, "0")}`));

  const chooseMonth = (index: number) => { setActiveMonthIndex(index); setSelectedDate(dateKey(MONTH_INDICES[index], 1)); setActiveSection("calendar"); };
  const changeMonth = (direction: number) => chooseMonth(Math.min(Math.max(activeMonthIndex + direction, 0), MONTHS.length - 1));

  const addEvent = () => {
    const title = draftTitle.trim();
    if (!title) { setToast("Give the event a title before adding it to the demo calendar."); return; }
    setCustomItems(current => [...current, { id: `custom-${Date.now()}`, title, category: draftCategory, date: selectedDate, time: draftTime, source: "Demo account" }]);
    setDraftTitle(""); setShowComposer(false); setToast(`Added “${title}” to ${formatDate(selectedDate)}.`);
  };

  const addDemoAccount = () => {
    const sequence = connections.length + 1;
    setConnections(current => [...current, { id: `demo-${sequence}`, email: `study.account${sequence}@gmail.com`, kind: "Demo", calendarCount: 1, status: "Demo", lastSync: "Local sample data" }]);
    setShowAccountSheet(false); setToast("A local demo account was added. No Google data was accessed.");
  };

  const simulateSync = () => {
    setConnections(current => current.map(connection => connection.status === "Demo" ? { ...connection, lastSync: "Demo sync complete just now" } : connection));
    setToast("Demo sync complete. Live changes will use Google Calendar watch channels after OAuth activation.");
  };

  return (
    <div className="planner-shell">
      <aside className="planner-rail">
        <div className="identity-block">
          <img src="/manus-storage/academic-calendar-logo_525d2637.png" alt="My Plan calendar mark" className="identity-mark" />
          <div><p>Academic calendar</p><strong>MY PLAN</strong></div>
        </div>
        <div className="mode-flag"><ShieldCheck size={14} /> Demonstration mode</div>
        <nav className="rail-navigation" aria-label="Application sections">
          <PanelButton section="calendar" active={activeSection} icon={CalendarDays} label="Calendar" onClick={() => setActiveSection("calendar")} />
          <PanelButton section="accounts" active={activeSection} icon={CirclePlus} label="Accounts" onClick={() => setActiveSection("accounts")} />
          <PanelButton section="sync" active={activeSection} icon={RefreshCw} label="Sync center" onClick={() => setActiveSection("sync")} />
          <PanelButton section="spark" active={activeSection} icon={Sparkles} label="Gemini Spark" onClick={() => setActiveSection("spark")} />
        </nav>
        <div className="rail-months"><p>Semester</p>{MONTHS.map((month, index) => <button key={month} className={index === activeMonthIndex ? "is-current" : ""} onClick={() => chooseMonth(index)}><span>{String(index + 8).padStart(2, "0")}</span>{month.split(" ")[0]}</button>)}</div>
        <p className="rail-footer">Google sign-in and automatic synchronization activate only after app-owned OAuth credentials are added.</p>
      </aside>

      <main className="planner-main">
        <header className="topline"><div className="mobile-identity"><img src="/manus-storage/academic-calendar-logo_525d2637.png" alt="" /> MY PLAN</div><span><i /> {toast}</span><button onClick={() => setShowAccountSheet(true)}><CirclePlus size={15} /> Add account</button></header>

        {activeSection === "calendar" && <>
          <section className="planner-hero">
            <div><p className="eyebrow"><GraduationCap size={15} /> 10-week turnaround</p><h1>Plan the semester.<br />Keep the signal clear.</h1><p className="hero-body">A single view for your academic plan, connected accounts, and the work that needs your attention next.</p></div>
            <div className="hero-actions"><button className="accent-button" onClick={() => setShowComposer(true)}><Plus size={16} /> Add event</button><button className="quiet-button" onClick={simulateSync}><RefreshCw size={15} /> Sync demo</button></div>
          </section>
          <section className="calendar-card">
            <div className="calendar-toolbar"><div className="month-switch"><button disabled={activeMonthIndex === 0} onClick={() => changeMonth(-1)} aria-label="Previous month"><ChevronLeft size={18} /></button><h2>{MONTHS[activeMonthIndex]}</h2><button disabled={activeMonthIndex === MONTHS.length - 1} onClick={() => changeMonth(1)} aria-label="Next month"><ChevronRight size={18} /></button></div><div className="month-jumps">{MONTHS.map((month, index) => <button key={month} className={index === activeMonthIndex ? "is-active" : ""} onClick={() => chooseMonth(index)}>{month.slice(0, 3)}</button>)}</div></div>
            <div className="calendar-content"><section className="month-grid"><div className="weekday-labels">{WEEKDAYS.map(day => <span key={day}>{day}</span>)}</div><div className="date-board">{calendarDays.map((day, index) => { if (!day) return <div key={`empty-${index}`} className="date-box is-empty" />; const key = dateKey(activeMonth, day); const items = allItems.filter(item => item.date === key); return <button key={key} className={`date-box ${key === selectedDate ? "is-selected" : ""}`} onClick={() => setSelectedDate(key)}><b>{day}</b>{items.length > 0 && <span className="date-dots">{items.slice(0, 3).map(item => <i key={item.id} className={`dot-${item.category}`} />)}</span>}</button>; })}</div><div className="legend"><span><i className="dot-critical" />Critical</span><span><i className="dot-quiz" />Quiz</span><span><i className="dot-focus" />Focus</span><span><i className="dot-recovery" />Recovery</span></div></section>
              <aside className="day-card"><div className="paper-tabs"><i /><i /><i /></div><p className="eyebrow"><ListChecks size={14} /> Selected day</p><h3>{formatDate(selectedDate)}</h3><div className="day-items">{selectedItems.length ? selectedItems.map(item => <article key={item.id} className={`item-card item-${item.category}`}><span>{categoryLabel[item.category]} {item.time ? `· ${item.time}` : ""}</span><strong>{item.title}</strong><small>{item.source}</small></article>) : <p className="empty-state">No event is scheduled. Add a study block or select another marked date.</p>}</div><div className="section-rule" /><p className="eyebrow"><CalendarDays size={14} /> This month</p><div className="month-list">{monthItems.slice(0, 5).map(item => <button key={item.id} onClick={() => setSelectedDate(item.date)}><i className={`dot-${item.category}`} /><span>{item.title}</span><ArrowRight size={14} /></button>)}</div></aside></div>
          </section>
        </>}

        {activeSection === "accounts" && <section className="workspace-panel"><div className="panel-heading"><div><p className="eyebrow"><CirclePlus size={14} /> Multiple Google identities</p><h1>Connected accounts</h1><p>Each app user can link personal Google and eligible Workspace calendars. These are local demo connections until the app owner activates Google OAuth.</p></div><button className="accent-button" onClick={() => setShowAccountSheet(true)}><Plus size={16} /> Add demo account</button></div><div className="account-stack">{connections.map(connection => <article key={connection.id} className="account-row"><div className="account-monogram">{connection.email.charAt(0).toUpperCase()}</div><div className="account-main"><strong>{connection.email}</strong><span>{connection.kind} · {connection.calendarCount} calendar{connection.calendarCount === 1 ? "" : "s"} available</span></div><div className={`status-pill ${connection.status === "Connected" ? "connected" : "demo"}`}>{connection.status}</div><small>{connection.lastSync}</small></article>)}</div><div className="activation-note"><ShieldCheck size={18} /><div><strong>What activates later</strong><p>Real Google sign-in, secure token storage, calendar selection, and automatic change notifications are prepared but need your Google Cloud OAuth client before accessing any external account.</p></div></div></section>}

        {activeSection === "sync" && <section className="workspace-panel"><div className="panel-heading"><div><p className="eyebrow"><CloudCog size={14} /> Automatic synchronization</p><h1>Sync center</h1><p>Demo actions validate the app experience without making requests to Google. The production path will use incremental sync tokens and Google Calendar watch channels.</p></div><button className="accent-button" onClick={simulateSync}><RefreshCw size={16} /> Run demo sync</button></div><div className="sync-grid"><article><span>Connection state</span><strong>{connections.filter(connection => connection.status === "Demo").length} demo profile{connections.filter(connection => connection.status === "Demo").length === 1 ? "" : "s"}</strong><p>Ready to be swapped for authorized Google identities.</p></article><article><span>Event cache</span><strong>{allItems.length} local events</strong><p>Includes academic-plan events and events you add in this session.</p></article><article><span>Watch channels</span><strong>Prepared, inactive</strong><p>They begin only after the public HTTPS callback and OAuth client are configured.</p></article></div><div className="sync-timeline"><div><i className="dot-focus" /><span>1</span><p>Full calendar import</p></div><div><i className="dot-focus" /><span>2</span><p>Store sync token</p></div><div><i className="dot-focus" /><span>3</span><p>Receive change signal</p></div><div><i className="dot-focus" /><span>4</span><p>Incremental refresh</p></div></div></section>}

        {activeSection === "spark" && <section className="workspace-panel spark-panel"><div className="panel-heading"><div><p className="eyebrow"><Sparkles size={14} /> Agent-ready calendar</p><h1>Gemini Spark connection</h1><p>The app now exposes safe, read-only demonstration calendar tools through an MCP route. Live write actions remain inactive until Google OAuth is configured.</p></div><span className="status-pill demo">Demo endpoint ready</span></div><div className="spark-layout"><div className="spark-tools"><h3>Available now</h3><p><Check size={15} /> List the included academic deadlines.</p><p><Check size={15} /> Report the Google activation state clearly.</p><h3 className="planned-tools">Prepared for activation</h3><p><Check size={15} /> Create, update, or remove a study block.</p><p><Check size={15} /> Summarize selected calendar milestones.</p></div><div className="mcp-box"><span>Demonstration MCP route</span><code>/api/mcp</code><button onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/api/mcp`); setToast("The current MCP route was copied. It only returns safe demonstration data until activation."); }}><Copy size={15} /> Copy this app's MCP URL</button><small>Gemini Spark users add the eventual public URL in Connected Apps. Google may require write confirmations.</small></div></div><a className="reference-link" href="https://support.google.com/gemini/answer/17209137" target="_blank" rel="noreferrer">Review Gemini Spark custom app requirements <ExternalLink size={14} /></a></section>}
      </main>

      {showComposer && <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowComposer(false)}><div className="modal-sheet" role="dialog" aria-modal="true" aria-labelledby="event-title" onMouseDown={event => event.stopPropagation()}><div className="modal-heading"><div><p className="eyebrow"><Plus size={14} /> Demo calendar</p><h2 id="event-title">Add a study event</h2></div><button className="icon-button" onClick={() => setShowComposer(false)} aria-label="Close"><X size={18} /></button></div><label>Selected date<input value={formatDate(selectedDate)} readOnly /></label><label>Title<input autoFocus value={draftTitle} onChange={event => setDraftTitle(event.target.value)} placeholder="e.g. DSA practice set" /></label><div className="form-row"><label>Time<input value={draftTime} onChange={event => setDraftTime(event.target.value)} /></label><label>Type<select value={draftCategory} onChange={event => setDraftCategory(event.target.value as Category)}><option value="focus">Focus block</option><option value="quiz">Quiz</option><option value="critical">Critical</option><option value="recovery">Recovery</option></select></label></div><button className="accent-button full" onClick={addEvent}><Plus size={16} /> Add to demo calendar</button></div></div>}

      {showAccountSheet && <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowAccountSheet(false)}><div className="modal-sheet" role="dialog" aria-modal="true" aria-labelledby="account-title" onMouseDown={event => event.stopPropagation()}><div className="modal-heading"><div><p className="eyebrow"><CirclePlus size={14} /> Account link</p><h2 id="account-title">Add a calendar account</h2></div><button className="icon-button" onClick={() => setShowAccountSheet(false)} aria-label="Close"><X size={18} /></button></div><div className="activation-card"><ShieldCheck size={20} /><div><strong>Real Google sign-in is waiting for activation.</strong><p>Once the app owner adds Google OAuth credentials, this screen opens Google’s normal sign-in page instead of creating a local profile.</p></div></div><button className="accent-button full" onClick={addDemoAccount}><Plus size={16} /> Add another local demo account</button><button className="quiet-button full" onClick={() => { setShowAccountSheet(false); setToast("Google connection remains safely inactive until owner credentials are added."); }}>Keep demo mode</button></div></div>}
    </div>
  );
}
