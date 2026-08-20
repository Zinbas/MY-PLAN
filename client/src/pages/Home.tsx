/**
 * Design: Paper Field Notes — an ongoing, mobile-first academic calendar with a warm paper
 * surface, editorial typography, notebook rules, restrained terracotta signals, and quiet motion.
 */
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { addDays, addMonths, dateKey, daysInMonth, expandRepeatingBlock, isConflict, monthStart, PlannerBlock, RepeatRule, sameDay, startOfWeek } from "@/lib/ongoingCalendar";
import { CalendarDays, Check, ChevronLeft, ChevronRight, CirclePlus, CloudCog, Copy, ExternalLink, GraduationCap, ListChecks, Menu, Plus, RefreshCw, Search, ShieldCheck, Sparkles, Star, X } from "lucide-react";

type ViewMode = "month" | "week" | "agenda";
type Section = "calendar" | "accounts" | "sync" | "spark";
type SourceFilter = "all" | "academic" | "planner" | "linked";

const academicEvents: PlannerBlock[] = [
  { id: "assignment", title: "Assignment Submission - I", startAt: new Date(2026, 7, 12, 17), endAt: new Date(2026, 7, 12, 18), source: "academic", priority: "high" },
  { id: "java-quiz", title: "Java 1st Quiz", startAt: new Date(2026, 7, 17, 10), endAt: new Date(2026, 7, 17, 11), source: "academic", priority: "high" },
  { id: "attendance", title: "Attendance Monitoring - I", startAt: new Date(2026, 7, 22, 9), endAt: new Date(2026, 7, 22, 10), source: "academic" },
  { id: "sessional-one", title: "SESSIONAL I EXAMINATIONS", startAt: new Date(2026, 8, 16, 9), endAt: new Date(2026, 8, 21, 17), source: "academic", priority: "high" },
  { id: "sessional-two", title: "SESSIONAL II EXAMINATIONS", startAt: new Date(2026, 9, 22, 9), endAt: new Date(2026, 9, 28, 17), source: "academic", priority: "high" },
  { id: "practicals", title: "Practical Examinations", startAt: new Date(2026, 10, 16, 9), endAt: new Date(2026, 10, 20, 17), source: "academic", priority: "high" },
  { id: "end-sem", title: "END SEMESTER THEORY EXAMS", startAt: new Date(2026, 10, 25, 9), endAt: new Date(2026, 11, 15, 17), source: "academic", priority: "high" },
];

const sourceLabel: Record<SourceFilter, string> = { all: "All sources", academic: "Academic", planner: "Study blocks", linked: "Linked calendars" };
const loadBlocks = (): PlannerBlock[] => { try { return JSON.parse(localStorage.getItem("my-plan-blocks") || "[]").map((block: PlannerBlock) => ({ ...block, startAt: new Date(block.startAt), endAt: new Date(block.endAt), repeatUntil: block.repeatUntil ? new Date(block.repeatUntil) : null })); } catch { return []; } };

function formatMonth(date: Date) { return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date); }
function formatShort(date: Date) { return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(date); }
function displayTime(date: Date) { return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date); }

export default function Home() {
  const { isAuthenticated } = useAuth();
  const readiness = trpc.calendar.readiness.useQuery();
  const persistedConnections = trpc.calendar.connections.useQuery(undefined, { enabled: isAuthenticated });
  const [cursor, setCursor] = useState(() => monthStart(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [view, setView] = useState<ViewMode>("month");
  const [section, setSection] = useState<Section>("calendar");
  const [filter, setFilter] = useState<SourceFilter>("all");
  const [search, setSearch] = useState("");
  const [plannerBlocks, setPlannerBlocks] = useState<PlannerBlock[]>(loadBlocks);
  const [showComposer, setShowComposer] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showDateJump, setShowDateJump] = useState(false);
  const [jumpMonth, setJumpMonth] = useState(() => String(new Date().getMonth() + 1));
  const [jumpYear, setJumpYear] = useState(() => String(new Date().getFullYear()));
  const [draftTitle, setDraftTitle] = useState("");
  const [draftTime, setDraftTime] = useState("19:00");
  const [draftRepeat, setDraftRepeat] = useState<RepeatRule>("none");
  const [draftPriority, setDraftPriority] = useState<"high" | "normal">("normal");
  const [toast, setToast] = useState("Your calendar can move beyond every semester. No date limit.");

  useEffect(() => { localStorage.setItem("my-plan-blocks", JSON.stringify(plannerBlocks)); }, [plannerBlocks]);
  const eventRange = useMemo(() => ({ startAt: addMonths(cursor, -1), endAt: addMonths(cursor, 2) }), [cursor]);
  const linkedEvents = trpc.calendar.events.useQuery(eventRange, { enabled: isAuthenticated });
  const activeStart = view === "week" ? startOfWeek(selectedDate) : view === "agenda" ? new Date() : monthStart(cursor);
  const activeEnd = view === "week" ? addDays(activeStart, 7) : view === "agenda" ? addDays(new Date(), 30) : addMonths(monthStart(cursor), 1);

  const blocks = useMemo(() => plannerBlocks.flatMap(block => expandRepeatingBlock(block, addMonths(activeStart, -1), addMonths(activeEnd, 1))), [plannerBlocks, activeStart, activeEnd]);
  const linkedBlocks = useMemo<PlannerBlock[]>(() => (linkedEvents.data ?? []).map(event => ({ id: `linked-${event.id}`, title: event.title, startAt: event.startAt, endAt: event.endAt, source: "linked", priority: "normal" })), [linkedEvents.data]);
  const visibleEvents = useMemo(() => [...academicEvents, ...blocks, ...linkedBlocks].filter(event => {
    const searchable = event.title.toLowerCase().includes(search.toLowerCase());
    return searchable && (filter === "all" || event.source === filter) && event.endAt >= activeStart && event.startAt < activeEnd;
  }).sort((a, b) => a.startAt.getTime() - b.startAt.getTime()), [activeStart, activeEnd, blocks, filter, linkedBlocks, search]);
  const selectedEvents = visibleEvents.filter(event => sameDay(event.startAt, selectedDate));
  const upcoming = [...academicEvents, ...blocks, ...linkedBlocks].filter(event => event.endAt >= new Date()).sort((a, b) => a.startAt.getTime() - b.startAt.getTime()).slice(0, 6);

  const goToday = () => { const today = new Date(); setCursor(monthStart(today)); setSelectedDate(today); setToast("Back to today."); };
  const changeCursor = (amount: number) => setCursor(current => addMonths(current, amount));
  const openSection = (next: Section) => { setSection(next); setShowSidebar(false); };
  const returnHome = () => { goToday(); openSection("calendar"); };
  const openDateJump = () => { setJumpMonth(String(cursor.getMonth() + 1)); setJumpYear(String(cursor.getFullYear())); setShowDateJump(true); setShowFilterMenu(false); };
  const applyDateJump = () => { const month = Number(jumpMonth); const year = Number(jumpYear); if (month < 1 || month > 12 || year < 1900 || year > 2200) return setToast("Enter a month from 1–12 and a year from 1900–2200."); const next = new Date(year, month - 1, 1); setCursor(next); setSelectedDate(next); setShowDateJump(false); setToast(`Showing ${formatMonth(next)}.`); };
  const addPlannerBlock = () => {
    if (!draftTitle.trim()) return setToast("Add a title before creating a study block.");
    const [hours, minutes] = draftTime.split(":").map(Number);
    const startAt = new Date(selectedDate); startAt.setHours(hours, minutes, 0, 0);
    const block: PlannerBlock = { id: `plan-${Date.now()}`, title: draftTitle.trim(), startAt, endAt: new Date(startAt.getTime() + 60 * 60 * 1000), source: "planner", priority: draftPriority, repeat: draftRepeat, repeatUntil: draftRepeat === "none" ? null : addMonths(startAt, 6), completed: false, checklist: [] };
    setPlannerBlocks(current => [...current, block]); setDraftTitle(""); setShowComposer(false); setToast(`Added “${block.title}” to your ongoing plan.`);
  };
  const toggleComplete = (event: PlannerBlock) => { const id = event.id.split(":")[0]; setPlannerBlocks(current => current.map(block => block.id === id ? { ...block, completed: !block.completed } : block)); };
  const duplicateBlock = (event: PlannerBlock) => { const id = event.id.split(":")[0]; const base = plannerBlocks.find(block => block.id === id); if (!base) return; const next = { ...base, id: `plan-${Date.now()}`, title: `${base.title} — copy`, startAt: addDays(base.startAt, 1), endAt: addDays(base.endAt, 1) }; setPlannerBlocks(current => [...current, next]); setToast("Study block duplicated for tomorrow."); };
  const rescheduleBlock = (event: PlannerBlock) => { const id = event.id.split(":")[0]; setPlannerBlocks(current => current.map(block => block.id === id ? { ...block, startAt: addDays(block.startAt, 1), endAt: addDays(block.endAt, 1) } : block)); setToast("Study block moved forward by one day."); };
  const deleteBlock = (event: PlannerBlock) => { const id = event.id.split(":")[0]; setPlannerBlocks(current => current.filter(block => block.id !== id)); setToast("Study block removed."); };

  const renderEvent = (event: PlannerBlock, compact = false) => <article key={event.id} className={`ongoing-event source-${event.source} ${event.completed ? "is-complete" : ""}`}><div className="event-meta"><span>{event.source === "academic" ? "Academic" : event.source === "linked" ? "Linked" : "Study block"}</span>{event.priority === "high" ? <Star size={12} fill="currentColor" /> : null}{event.source === "planner" && isConflict(event, blocks) ? <em>Conflict</em> : null}</div><strong>{event.title}</strong><small>{displayTime(event.startAt)} · {event.repeat && event.repeat !== "none" ? `${event.repeat} routine` : "one time"}</small>{!compact && event.source === "planner" ? <div className="event-tools"><button onClick={() => toggleComplete(event)}><Check size={13} /> {event.completed ? "Reopen" : "Done"}</button><button onClick={() => duplicateBlock(event)}>Copy</button><button onClick={() => rescheduleBlock(event)}>+1 day</button><button onClick={() => deleteBlock(event)}>Remove</button></div> : null}</article>;

  return <div className="ongoing-shell">
    {showSidebar ? <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setShowSidebar(false)} /> : null}
    <aside className={`ongoing-sidebar ${showSidebar ? "is-open" : ""}`}><button className="brand-line" onClick={returnHome} aria-label="Return to calendar home"><div className="tab-mark"><i /><i /><i /></div><div><span>Academic calendar</span><strong>MY PLAN</strong></div></button><div className="side-nav"><button className={section === "calendar" ? "active" : ""} onClick={() => openSection("calendar")}><CalendarDays size={17} /> Calendar</button><button className={section === "accounts" ? "active" : ""} onClick={() => openSection("accounts")}><CirclePlus size={17} /> Accounts</button><button className={section === "sync" ? "active" : ""} onClick={() => openSection("sync")}><RefreshCw size={17} /> Sync center</button><button className={section === "spark" ? "active" : ""} onClick={() => openSection("spark")}><Sparkles size={17} /> Gemini Spark</button></div><div className="side-footer"><ShieldCheck size={15} /><p>Google activation is ready when your app-owned OAuth credentials are added.</p></div></aside>
    <main className="ongoing-main"><header className="ongoing-topbar"><button className="mobile-menu" onClick={() => setShowSidebar(value => !value)} aria-label="Toggle navigation"><Menu size={19} /></button><span className="toast-line">{toast}</span><div className="top-actions"><button onClick={goToday}>Today</button><button className="accent" onClick={() => { setShowComposer(true); openSection("calendar"); }}><Plus size={16} /> Add block</button></div></header>
      {section === "calendar" ? <><section className="ongoing-hero"><div><p className="kicker"><GraduationCap size={15} /> Ongoing calendar</p><h1>Every month ahead.<br />One clear plan.</h1><p>Move freely across years, coordinate study blocks, and keep academic milestones beside your life calendar.</p></div><div className="hero-stat"><span>Next up</span><strong>{upcoming[0] ? formatShort(upcoming[0].startAt) : "Clear day"}</strong><small>{upcoming[0]?.title || "No upcoming items"}</small></div></section>
      <div className="calendar-layout"><section className="calendar-workbench"><div className="calendar-controls"><div className="cursor-controls"><button onClick={() => changeCursor(-1)} aria-label="Previous month"><ChevronLeft size={18} /></button><h2>{view === "week" ? `${formatShort(activeStart)} — ${formatShort(addDays(activeStart, 6))}` : view === "agenda" ? "Next 30 days" : formatMonth(cursor)}</h2><button onClick={() => changeCursor(1)} aria-label="Next month"><ChevronRight size={18} /></button></div><div className="view-switch">{(["month", "week", "agenda"] as ViewMode[]).map(mode => <button key={mode} className={view === mode ? "active" : ""} onClick={() => setView(mode)}>{mode}</button>)}</div></div><div className="calendar-filters"><label className="search-field"><Search size={15} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search calendar" /></label><div className="control-anchor"><button className="control-trigger" aria-expanded={showFilterMenu} onClick={() => { setShowFilterMenu(value => !value); setShowDateJump(false); }}>{sourceLabel[filter]}</button>{showFilterMenu ? <div className="control-popover filter-popover">{(Object.entries(sourceLabel) as [SourceFilter, string][]).map(([key, label]) => <button key={key} className={filter === key ? "selected" : ""} onClick={() => { setFilter(key); setShowFilterMenu(false); }}>{label}{filter === key ? <Check size={14} /> : null}</button>)}</div> : null}</div><div className="control-anchor"><button className="control-trigger date-trigger" aria-expanded={showDateJump} onClick={openDateJump}><CalendarDays size={14} /> {formatMonth(cursor)}</button>{showDateJump ? <div className="control-popover date-popover"><p>Jump to a month</p><div><label>Month<input aria-label="Month number" inputMode="numeric" value={jumpMonth} onChange={event => setJumpMonth(event.target.value)} /></label><label>Year<input aria-label="Year number" inputMode="numeric" value={jumpYear} onChange={event => setJumpYear(event.target.value)} /></label></div><div className="popover-actions"><button onClick={() => setShowDateJump(false)}>Cancel</button><button className="apply-jump" onClick={applyDateJump}>Show month</button></div></div> : null}</div></div>
      {view === "month" ? <div className="month-view"><div className="weekdays">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => <span key={day}>{day}</span>)}</div><div className="month-board">{daysInMonth(cursor).map((day, index) => !day ? <div className="month-cell blank" key={`blank-${index}`} /> : <button key={dateKey(day)} onClick={() => setSelectedDate(day)} className={`month-cell ${sameDay(day, selectedDate) ? "selected" : ""} ${sameDay(day, new Date()) ? "today" : ""}`}><b>{day.getDate()}</b><div>{visibleEvents.filter(event => sameDay(event.startAt, day)).slice(0, 3).map(event => <span className={`dot ${event.source}`} key={event.id} />)}</div></button>)}</div></div> : null}
      {view === "week" ? <div className="week-view">{Array.from({ length: 7 }, (_, index) => addDays(activeStart, index)).map(day => <section key={dateKey(day)} className={`week-day ${sameDay(day, new Date()) ? "today" : ""}`}><button onClick={() => setSelectedDate(day)}><span>{new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(day)}</span><strong>{day.getDate()}</strong></button>{visibleEvents.filter(event => sameDay(event.startAt, day)).map(event => renderEvent(event, true))}</section>)}</div> : null}
      {view === "agenda" ? <div className="agenda-view">{visibleEvents.length ? visibleEvents.map(event => <div className="agenda-row" key={event.id}><time>{formatShort(event.startAt)}</time>{renderEvent(event)}</div>) : <p className="empty-agenda">No matching events in the next 30 days. Try a different filter or create a study block.</p>}</div> : null}</section>
      <aside className="selected-margin"><p className="kicker"><ListChecks size={14} /> Selected day</p><h3>{new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(selectedDate)}</h3>{selectedEvents.length ? selectedEvents.map(event => renderEvent(event)) : <p className="empty-agenda">Nothing scheduled. Add a focused study block.</p>}<div className="margin-rule" /><p className="kicker"><Check size={14} /> Today’s progress</p><strong>{blocks.filter(event => sameDay(event.startAt, new Date()) && event.completed).length} completed study block{blocks.filter(event => sameDay(event.startAt, new Date()) && event.completed).length === 1 ? "" : "s"}</strong></aside></div></> : null}
      {section === "accounts" ? <section className="workspace-card"><p className="kicker"><CirclePlus size={15} /> Multiple identities</p><h1>Connected accounts</h1><p>Each app user can link personal Google and eligible Workspace calendars. Demonstration profiles remain available while live OAuth is inactive.</p><div className="account-list">{(persistedConnections.data ?? []).length ? persistedConnections.data?.map(connection => <article key={connection.id}><strong>{connection.email}</strong><span>{connection.accountType} · {connection.calendars.length} calendars</span></article>) : <article><strong>Demo account</strong><span>No external calendar accessed</span></article>}</div><button className="accent" disabled={!readiness.data?.googleOAuthReady} onClick={() => { window.location.href = isAuthenticated ? "/api/google/connect" : "/api/google/sign-in"; }}>Continue with Google <ExternalLink size={15} /></button></section> : null}
      {section === "sync" ? <section className="workspace-card"><p className="kicker"><CloudCog size={15} /> Sync architecture</p><h1>Connection health</h1><div className="sync-cards"><article><span>Calendar data</span><strong>{readiness.data?.googleOAuthReady ? "Ready to import" : "Demo mode"}</strong></article><article><span>Watch channels</span><strong>Prepared</strong></article><article><span>Mirrored events</span><strong>{linkedEvents.data?.length ?? 0}</strong></article></div><p>When your OAuth credentials are activated, MY PLAN imports selected calendars, saves sync cursors, and processes secure Google Calendar change notifications.</p></section> : null}
      {section === "spark" ? <section className="workspace-card spark-card"><p className="kicker"><Sparkles size={15} /> Agent-ready calendar</p><h1>Gemini Spark</h1><p>MY PLAN exposes a safe MCP endpoint for academic deadlines and calendar status. When live Google connections are enabled, confirmed actions can create and change study blocks.</p><code>/api/mcp</code><button onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/api/mcp`); setToast("MCP route copied."); }}><Copy size={15} /> Copy MCP URL</button></section> : null}
    </main>
    {showComposer ? <div className="dialog-backdrop" onMouseDown={() => setShowComposer(false)}><section className="composer" role="dialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}><div><p className="kicker"><Plus size={14} /> Study block</p><h2>Plan a focused session</h2></div><button className="close" onClick={() => setShowComposer(false)} aria-label="Close"><X size={18} /></button><label>Title<input autoFocus value={draftTitle} onChange={event => setDraftTitle(event.target.value)} placeholder="e.g. Calculus PYQ set" /></label><div className="composer-row"><label>Time<input type="time" value={draftTime} onChange={event => setDraftTime(event.target.value)} /></label><label>Priority<select value={draftPriority} onChange={event => setDraftPriority(event.target.value as "high" | "normal")}><option value="normal">Normal</option><option value="high">High</option></select></label></div><label>Repeat<select value={draftRepeat} onChange={event => setDraftRepeat(event.target.value as RepeatRule)}><option value="none">Does not repeat</option><option value="daily">Every day</option><option value="weekdays">Weekdays only</option><option value="weekly">Every week</option><option value="monthly">Every month</option></select></label><button className="accent full" onClick={addPlannerBlock}><Plus size={16} /> Add to MY PLAN</button></section></div> : null}
  </div>;
}
