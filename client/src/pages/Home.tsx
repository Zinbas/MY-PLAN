/**
 * Design: Paper Field Notes — an ongoing, mobile-first academic calendar with a warm paper
 * surface, editorial typography, notebook rules, restrained terracotta signals, and quiet motion.
 */
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { addDays, addMonths, conflictCountsFor, dateKey, daysInMonth, excludeRecurringDate, expandRepeatingBlock, findTimeConflicts, isTaskComplete, isTaskScheduled, monthStart, PersonalEvent, PlannerBlock, PlanTask, RepeatRule, sameDay, startOfWeek, taskDueState, taskEndAt, taskStatus, TaskStatus } from "@/lib/ongoingCalendar";
import { dailyQuoteForDate } from "@/lib/dailyQuote";
import { calendarFilterReasons } from "@/lib/calendarFilterReasons";
import { isValidImportDate } from "@/lib/importDates";
import { mapSelectedImportCandidates } from "@/lib/importSelection";
import { canViewAdminControls, mergeWorkspaceItemsById, workspaceScopeFor, workspaceStorageKey } from "@/lib/privateWorkspace";
import { onTimeCompletionStats, recentCompletedTasks, sortTodoTasks, weeklyActivity, type TodoSort } from "@/lib/taskInsights";
import { loadScopedBlocks, loadScopedEvents, loadScopedTasks } from "@/lib/workspaceLoader";
import { defaultNotificationPreferences, loadNotificationPreferences, loadReadNotificationIds, planningNotifications, saveReadNotificationIds, type NotificationPreferences } from "@/lib/notifications";
import { ArrowRight, BarChart3, Bell, BookOpenCheck, CalendarDays, CalendarPlus, Check, ChevronLeft, ChevronRight, CirclePlus, Clock3, CloudCog, Copy, Edit3, ExternalLink, Flag, GraduationCap, ListChecks, ListTodo, LogIn, LogOut, Menu, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Pause, Play, Plus, RefreshCw, Search, ShieldCheck, Sparkles, Square, Star, Trash2, Upload, UserRound, Users, X } from "lucide-react";

const LazyAdminUserDirectory = lazy(() => import("./AdminUserDirectory"));
const LazySparkWorkspace = lazy(() => import("./SparkWorkspace"));
const LazyImportWorkspace = lazy(() => import("./ImportWorkspace"));
const MY_PLAN_LOGO_URL = "/manus-storage/my-plan-note-mark_567e5611.jpg";

function BrandLoader({ label, compact = false }: { label: string; compact?: boolean }) {
  return <section className={`my-plan-loader ${compact ? "is-compact" : ""}`} role="status" aria-live="polite"><img src={MY_PLAN_LOGO_URL} alt="MY PLAN" /><div><strong>MY PLAN</strong><span>{label}</span></div></section>;
}

type ViewMode = "month" | "week" | "agenda";
type Section = "welcome" | "calendar" | "todo" | "progress" | "tools" | "accounts" | "admin" | "sync" | "import" | "spark";
type SourceFilter = "all" | "academic" | "planner" | "event" | "task" | "linked";
type ItemTypeFilter = "all" | "event" | "planner" | "task";
type ScheduleHealthFilter = "all" | "conflicts" | "clear";
type PriorityFilter = "all" | "high";
type RoutineFilter = "all" | "one-time" | "recurring";
type CalendarTaskStatusFilter = "all" | TaskStatus | "completed";
type ComposerKind = "block" | "event" | "task";
type Priority = "high" | "normal";
type TodoFilter = "all" | "today" | "upcoming" | "overdue" | "completed";
type TourStep = { title: string; body: string; section: Section; eyebrow: string };
type DateContextMenu = { date: Date; x: number; y: number };
type ActiveTaskTimer = { taskId: string; accumulatedSeconds: number; startedAt: number | null };
type ImportCandidate = { id: string; title: string; kind: ComposerKind; date: string; time: string; durationMinutes: number; course: string; notes: string; weekdays?: number[]; confidence: number; approved: boolean };

const academicEvents: PlannerBlock[] = [
  { id: "assignment", title: "Assignment Submission - I", startAt: new Date(2026, 7, 12, 17), endAt: new Date(2026, 7, 12, 18), source: "academic", priority: "high" },
  { id: "java-quiz", title: "Java 1st Quiz", startAt: new Date(2026, 7, 17, 10), endAt: new Date(2026, 7, 17, 11), source: "academic", priority: "high" },
  { id: "attendance", title: "Attendance Monitoring - I", startAt: new Date(2026, 7, 22, 9), endAt: new Date(2026, 7, 22, 10), source: "academic" },
  { id: "sessional-one", title: "SESSIONAL I EXAMINATIONS", startAt: new Date(2026, 8, 16, 9), endAt: new Date(2026, 8, 21, 17), source: "academic", priority: "high" },
  { id: "sessional-two", title: "SESSIONAL II EXAMINATIONS", startAt: new Date(2026, 9, 22, 9), endAt: new Date(2026, 9, 28, 17), source: "academic", priority: "high" },
  { id: "practicals", title: "Practical Examinations", startAt: new Date(2026, 10, 16, 9), endAt: new Date(2026, 10, 20, 17), source: "academic", priority: "high" },
  { id: "end-sem", title: "END SEMESTER THEORY EXAMS", startAt: new Date(2026, 10, 25, 9), endAt: new Date(2026, 11, 15, 17), source: "academic", priority: "high" },
];

const sourceLabel: Record<SourceFilter, string> = { all: "All sources", academic: "Academic", planner: "Study blocks", event: "My events", task: "Tasks", linked: "Linked calendars" };
const composerCopy: Record<ComposerKind, { kicker: string; title: string; submit: string; placeholder: string }> = {
  block: { kicker: "Study block", title: "Plan a focused session", submit: "Add to MY PLAN", placeholder: "e.g. Calculus PYQ set" },
  event: { kicker: "Personal event", title: "Add a time-bound event", submit: "Save event", placeholder: "e.g. Meet project group" },
  task: { kicker: "Task", title: "Capture the next action", submit: "Save task", placeholder: "e.g. Finish DSA worksheet" },
};

const tourSteps: TourStep[] = [
  { eyebrow: "01 · Place the work", title: "Right-click a date to place your plan.", body: "On desktop, right-click any date to add a task, event, or focused study block. Calendar keeps moving as far into the future as you need.", section: "calendar" },
  { eyebrow: "02 · Capture the next action", title: "To-do keeps the important things small and visible.", body: "Add a task in seconds, group it by course or list, start it when you begin, and schedule it only when you know where it fits.", section: "todo" },
  { eyebrow: "03 · See real movement", title: "Progress reflects only work you completed.", body: "Review daily completion, upcoming deadlines, focused blocks, and list progress without artificial scores or pressure.", section: "progress" },
  { eyebrow: "04 · Connect only when ready", title: "Accounts are optional, connections are explicit.", body: "Plan locally at any time. Sign in when you want a MY PLAN account, then separately approve Google Calendar when its secure connection is activated.", section: "accounts" },
];

const loadBlocks = (scope = "guest"): PlannerBlock[] => loadScopedBlocks(localStorage, scope);
const loadEvents = (scope = "guest"): PersonalEvent[] => loadScopedEvents(localStorage, scope);
const loadTasks = (scope = "guest"): PlanTask[] => loadScopedTasks(localStorage, scope);
const loadActiveTimer = (scope = "guest"): ActiveTaskTimer | null => { try { const value = JSON.parse(localStorage.getItem(workspaceStorageKey("active-timer", scope)) || "null"); return value?.taskId ? value : null; } catch { return null; } };
const loadLegacyBlocks = (): PlannerBlock[] => { try { return JSON.parse(localStorage.getItem("my-plan-blocks") || "[]").map((block: PlannerBlock) => ({ ...block, startAt: new Date(block.startAt), endAt: new Date(block.endAt), repeatUntil: block.repeatUntil ? new Date(block.repeatUntil) : null })); } catch { return []; } };
const loadLegacyEvents = (): PersonalEvent[] => { try { return JSON.parse(localStorage.getItem("my-plan-events") || "[]").map((event: PersonalEvent) => ({ ...event, startAt: new Date(event.startAt), endAt: new Date(event.endAt) })); } catch { return []; } };
const loadLegacyTasks = (): PlanTask[] => { try { return JSON.parse(localStorage.getItem("my-plan-tasks") || "[]").map((task: PlanTask) => ({ ...task, dueAt: new Date(task.dueAt), scheduledStartAt: task.scheduledStartAt ? new Date(task.scheduledStartAt) : null, createdAt: task.createdAt ? new Date(task.createdAt) : new Date(), completedAt: task.completedAt ? new Date(task.completedAt) : null, status: task.completed || task.status === "done" ? "done" : task.status ?? "open" })); } catch { return []; } };

function formatMonth(date: Date) { return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date); }
function formatShort(date: Date) { return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(date); }
function displayTime(date: Date) { return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date); }
function timeInputValue(date: Date) { return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`; }
function readDraftDate(value: string, time: string) { const date = new Date(`${value}T${time || "09:00"}:00`); return Number.isNaN(date.getTime()) ? null : date; }
function formatElapsed(seconds: number) { const hours = Math.floor(seconds / 3600); const minutes = Math.floor((seconds % 3600) / 60); const remainder = seconds % 60; return `${hours ? `${String(hours).padStart(2, "0")}:` : ""}${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`; }

export default function Home() {
  const { isAuthenticated, user, loading, logout } = useAuth();
  const readiness = trpc.calendar.readiness.useQuery();
  const persistedConnections = trpc.calendar.connections.useQuery(undefined, { enabled: isAuthenticated });
  const createSparkAccessToken = trpc.spark.createAccessToken.useMutation();
  const sparkEventRange = useMemo(() => ({ startAt: addMonths(monthStart(new Date()), -12), endAt: addMonths(monthStart(new Date()), 24) }), []);
  const sparkEvents = trpc.spark.events.useQuery(sparkEventRange, { enabled: isAuthenticated });
  const isAdmin = canViewAdminControls(isAuthenticated, user?.role);
  const adminStatus = trpc.admin.status.useQuery(undefined, { enabled: Boolean(isAuthenticated && isAdmin) });
  const adminOverview = trpc.admin.overview.useQuery(undefined, { enabled: Boolean(isAuthenticated && isAdmin) });
  const storageScope = workspaceScopeFor(isAuthenticated, user?.id);
  const storedScope = useRef(storageScope);
  const [cursor, setCursor] = useState(() => monthStart(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [view, setView] = useState<ViewMode>("month");
  const [section, setSection] = useState<Section>(() => localStorage.getItem("my-plan-welcome-seen") || localStorage.getItem("my-plan-welcome-retired") ? "calendar" : "welcome");
  const [filter, setFilter] = useState<SourceFilter>("all");
  const [itemTypeFilter, setItemTypeFilter] = useState<ItemTypeFilter>("all");
  const [scheduleHealthFilter, setScheduleHealthFilter] = useState<ScheduleHealthFilter>("all");
  const [calendarPriorityFilter, setCalendarPriorityFilter] = useState<PriorityFilter>("all");
  const [routineFilter, setRoutineFilter] = useState<RoutineFilter>("all");
  const [calendarTaskStatusFilter, setCalendarTaskStatusFilter] = useState<CalendarTaskStatusFilter>("all");
  const [calendarCourseFilter, setCalendarCourseFilter] = useState("All courses / lists");
  const [todoFilter, setTodoFilter] = useState<TodoFilter>("all");
  const [todoListFilter, setTodoListFilter] = useState("All lists");
  const [todoSort, setTodoSort] = useState<TodoSort>("due");
  const [bulkCompleteTaskIds, setBulkCompleteTaskIds] = useState<string[] | null>(null);
  const [search, setSearch] = useState("");
  const [plannerBlocks, setPlannerBlocks] = useState<PlannerBlock[]>(() => loadBlocks());
  const [personalEvents, setPersonalEvents] = useState<PersonalEvent[]>(() => loadEvents());
  const [tasks, setTasks] = useState<PlanTask[]>(() => loadTasks());
  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem("my-plan-sidebar-collapsed") === "true");
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [showDateJump, setShowDateJump] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [composerKind, setComposerKind] = useState<ComposerKind>("block");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [jumpMonth, setJumpMonth] = useState(() => String(new Date().getMonth() + 1));
  const [jumpYear, setJumpYear] = useState(() => String(new Date().getFullYear()));
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDate, setDraftDate] = useState(() => dateKey(new Date()));
  const [draftTime, setDraftTime] = useState("19:00");
  const [draftDuration, setDraftDuration] = useState("60");
  const [draftRepeat, setDraftRepeat] = useState<RepeatRule>("none");
  const [draftPriority, setDraftPriority] = useState<Priority>("normal");
  const [draftCourse, setDraftCourse] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [draftScheduleTask, setDraftScheduleTask] = useState(true);
  const [showTour, setShowTour] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [welcomeRetired, setWelcomeRetired] = useState(() => Boolean(localStorage.getItem("my-plan-welcome-retired")));
  const [dateContextMenu, setDateContextMenu] = useState<DateContextMenu | null>(null);
  const [mobileDateAction, setMobileDateAction] = useState<Date | null>(null);
  const [activeTimer, setActiveTimer] = useState<ActiveTaskTimer | null>(() => loadActiveTimer());
  const [importCandidates, setImportCandidates] = useState<ImportCandidate[]>([]);
  const [importFileName, setImportFileName] = useState("");
  const [importMessage, setImportMessage] = useState("Choose a file and MY PLAN will make an editable set of suggestions.");
  const [lastAutoImportIds, setLastAutoImportIds] = useState<{ blockIds: string[]; eventIds: string[]; taskIds: string[] } | null>(null);
  const [timerNow, setTimerNow] = useState(() => Date.now());
  const [toast, setToast] = useState("Your calendar can move beyond every semester. No date limit.");
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(() => loadNotificationPreferences(localStorage, "guest"));
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>(() => loadReadNotificationIds(localStorage, "guest"));
  const [notificationReadyScope, setNotificationReadyScope] = useState(storageScope);
  const [conflictNotice, setConflictNotice] = useState<{ title: string; conflicts: { title: string; source: PlannerBlock["source"]; overlapMinutes: number }[] } | null>(null);
  const [recurringRemovalTarget, setRecurringRemovalTarget] = useState<PlannerBlock | null>(null);
  const [recurringEditTarget, setRecurringEditTarget] = useState<PlannerBlock | null>(null);
  const [sparkAccessToken, setSparkAccessToken] = useState<string | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 820px)").matches);
  const popoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMobileDateTap = useRef<{ key: string; at: number } | null>(null);
  const importFileInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (storedScope.current !== storageScope) {
      storedScope.current = storageScope;
      setPlannerBlocks(loadBlocks(storageScope));
      setPersonalEvents(loadEvents(storageScope));
      setTasks(loadTasks(storageScope));
      setActiveTimer(loadActiveTimer(storageScope));
      setNotificationPreferences(loadNotificationPreferences(localStorage, storageScope));
      setReadNotificationIds(loadReadNotificationIds(localStorage, storageScope));
      setNotificationReadyScope(storageScope);
      return;
    }
    localStorage.setItem(workspaceStorageKey("blocks", storageScope), JSON.stringify(plannerBlocks));
    localStorage.setItem(workspaceStorageKey("events", storageScope), JSON.stringify(personalEvents));
    localStorage.setItem(workspaceStorageKey("tasks", storageScope), JSON.stringify(tasks));
    if (activeTimer) localStorage.setItem(workspaceStorageKey("active-timer", storageScope), JSON.stringify(activeTimer)); else localStorage.removeItem(workspaceStorageKey("active-timer", storageScope));
  }, [activeTimer, personalEvents, plannerBlocks, storageScope, tasks]);
  useEffect(() => {
    if (notificationReadyScope !== storageScope) {
      setNotificationPreferences(loadNotificationPreferences(localStorage, storageScope));
      setReadNotificationIds(loadReadNotificationIds(localStorage, storageScope));
      setNotificationReadyScope(storageScope);
      return;
    }
    localStorage.setItem(workspaceStorageKey("notification-preferences", storageScope), JSON.stringify(notificationPreferences));
    saveReadNotificationIds(localStorage, storageScope, readNotificationIds);
  }, [notificationPreferences, notificationReadyScope, readNotificationIds, storageScope]);
  useEffect(() => { localStorage.setItem("my-plan-sidebar-collapsed", String(sidebarCollapsed)); }, [sidebarCollapsed]);
  useEffect(() => {
    if (!isAuthenticated || !isAdmin || !user?.id) return;
    const migrationMarker = `my-plan-admin-local-plan-migrated:${user.id}`;
    if (localStorage.getItem(migrationMarker)) return;
    setPlannerBlocks(current => mergeWorkspaceItemsById(loadLegacyBlocks(), current));
    setPersonalEvents(current => mergeWorkspaceItemsById(loadLegacyEvents(), current));
    setTasks(current => mergeWorkspaceItemsById(loadLegacyTasks(), current));
    localStorage.setItem(migrationMarker, "true");
  }, [isAdmin, isAuthenticated, user?.id]);
  useEffect(() => () => { if (popoverTimer.current) clearTimeout(popoverTimer.current); }, []);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 820px)");
    const updateViewport = () => setIsMobileViewport(media.matches);
    updateViewport();
    media.addEventListener("change", updateViewport);
    return () => media.removeEventListener("change", updateViewport);
  }, []);
  useEffect(() => { if (!activeTimer?.startedAt) return; const interval = window.setInterval(() => setTimerNow(Date.now()), 1000); return () => window.clearInterval(interval); }, [activeTimer?.startedAt]);
  useEffect(() => { if (!isAuthenticated || welcomeRetired) return; localStorage.setItem("my-plan-welcome-retired", "true"); localStorage.setItem("my-plan-welcome-seen", "true"); setWelcomeRetired(true); setSection("calendar"); }, [isAuthenticated, welcomeRetired]);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") { closePopovers(); setShowComposer(false); setDateContextMenu(null); setMobileDateAction(null); setShowTour(false); setShowNotifications(false); } };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  });

  const closePopovers = () => { if (popoverTimer.current) clearTimeout(popoverTimer.current); setShowFilterMenu(false); setShowMoreFilters(false); setShowDateJump(false); };
  const schedulePopoverDismissal = () => { if (popoverTimer.current) clearTimeout(popoverTimer.current); popoverTimer.current = setTimeout(closePopovers, 160); };
  const cancelPopoverDismissal = () => { if (popoverTimer.current) clearTimeout(popoverTimer.current); };
  const activeTourSteps = useMemo<TourStep[]>(() => isMobileViewport ? [
    { eyebrow: "01 · Quick plan", title: "Double-tap a date to place your plan.", body: "On your phone, double-tap any date to add a task, event, or focused study block without leaving the calendar.", section: "calendar" },
    ...tourSteps.slice(1),
  ] : tourSteps, [isMobileViewport]);
  const eventRange = useMemo(() => ({ startAt: addMonths(cursor, -1), endAt: addMonths(cursor, 2) }), [cursor]);
  const linkedEvents = trpc.calendar.events.useQuery(eventRange, { enabled: isAuthenticated });
  const updateCalendarVisibility = trpc.calendar.setVisibility.useMutation({ onSuccess: () => { void persistedConnections.refetch(); void linkedEvents.refetch(); setToast("Calendar selection saved. MY PLAN will only show and sync the calendars you selected."); } });
  const extractSchedule = trpc.schedule.extract.useMutation({
    onSuccess: result => {
      const candidates = result.candidates.map(candidate => ({ ...candidate, approved: false }));
      setImportCandidates(candidates);
      setLastAutoImportIds(null);
      setImportMessage(candidates.length ? `${candidates.length} suggestion${candidates.length === 1 ? "" : "s"} found. Select what to add, enter a date for each selected item, and add a time only when one matters.` : "No usable calendar or task candidates were found. Try a clearer file or enter items manually.");
    },
    onError: error => setImportMessage(error.message || "The file could not be scanned. Please try a supported file under 10 MB."),
  });
  const activeStart = view === "week" ? startOfWeek(selectedDate) : view === "agenda" ? new Date() : monthStart(cursor);
  const activeEnd = view === "week" ? addDays(activeStart, 7) : view === "agenda" ? addDays(new Date(), 30) : addMonths(monthStart(cursor), 1);
  const blocks = useMemo(() => plannerBlocks.flatMap(block => expandRepeatingBlock(block, addMonths(activeStart, -1), addMonths(activeEnd, 1))), [plannerBlocks, activeStart, activeEnd]);
  const inferredLastImportIds = useMemo(() => {
    const timestampFor = (id: string) => Number(id.match(/^import-(?:block|event|task)-(\d+)-/)?.[1] || 0);
    const latest = Math.max(0, ...plannerBlocks.map(block => timestampFor(block.id)), ...personalEvents.map(event => timestampFor(event.id)), ...tasks.map(task => timestampFor(task.id)));
    if (!latest) return null;
    const hasTimestamp = (id: string) => timestampFor(id) === latest;
    return { blockIds: plannerBlocks.filter(block => hasTimestamp(block.id)).map(block => block.id), eventIds: personalEvents.filter(event => hasTimestamp(event.id)).map(event => event.id), taskIds: tasks.filter(task => hasTimestamp(task.id)).map(task => task.id) };
  }, [plannerBlocks, personalEvents, tasks]);
  const eventBlocks = useMemo<PlannerBlock[]>(() => [...personalEvents.map(event => ({ id: event.id, title: event.title, startAt: event.startAt, endAt: event.endAt, source: "event" as const, priority: event.priority, course: event.course, notes: event.notes })), ...(sparkEvents.data ?? []).map(event => ({ id: `spark-${event.id}`, title: event.title, startAt: event.startAt, endAt: event.endAt, source: "event" as const, priority: "normal" as Priority, course: "Gemini Spark", notes: event.description || "Created through your connected Spark app." }))], [personalEvents, sparkEvents.data]);
  const taskBlocks = useMemo<PlannerBlock[]>(() => tasks.filter(isTaskScheduled).map(task => ({ id: task.id, title: task.title, startAt: task.scheduledStartAt!, endAt: taskEndAt(task), source: "task", priority: task.priority, completed: isTaskComplete(task) })), [tasks]);
  const linkedBlocks = useMemo<PlannerBlock[]>(() => (linkedEvents.data ?? []).map(event => ({ id: `linked-${event.id}`, title: event.title, startAt: event.startAt, endAt: event.endAt, source: "linked", priority: "normal" })), [linkedEvents.data]);
  const selectedLinkedCalendarCount = useMemo(() => (persistedConnections.data ?? []).reduce((total, connection) => total + connection.calendars.filter(calendar => calendar.isVisible).length, 0), [persistedConnections.data]);
  const allCalendarBlocks = useMemo(() => [...(isAdmin ? academicEvents : []), ...blocks, ...eventBlocks, ...taskBlocks, ...linkedBlocks], [blocks, eventBlocks, isAdmin, linkedBlocks, taskBlocks]);
  const notificationItems = useMemo(() => planningNotifications(tasks, [...blocks, ...eventBlocks, ...taskBlocks], new Date(), notificationPreferences), [blocks, eventBlocks, notificationPreferences, taskBlocks, tasks]);
  const unreadNotificationItems = useMemo(() => notificationItems.filter(item => !readNotificationIds.includes(item.id)), [notificationItems, readNotificationIds]);
  const calendarConflictCounts = useMemo(() => conflictCountsFor(allCalendarBlocks), [allCalendarBlocks]);
  const calendarCourses = useMemo(() => ["All courses / lists", ...Array.from(new Set([...allCalendarBlocks.map(event => event.course).filter(Boolean), ...tasks.map(task => task.course).filter(Boolean)])).sort()], [allCalendarBlocks, tasks]);
  const calendarTaskStatuses = useMemo(() => new Map(tasks.map(task => [task.id, taskStatus(task)])), [tasks]);
  const activeSecondaryFilterCount = Number(itemTypeFilter !== "all") + Number(scheduleHealthFilter !== "all") + Number(calendarPriorityFilter !== "all") + Number(routineFilter !== "all") + Number(calendarTaskStatusFilter !== "all") + Number(calendarCourseFilter !== "All courses / lists");
  const activeFilterCount = activeSecondaryFilterCount + Number(filter !== "all");
  const clearSecondaryFilters = () => { setItemTypeFilter("all"); setScheduleHealthFilter("all"); setCalendarPriorityFilter("all"); setRoutineFilter("all"); setCalendarTaskStatusFilter("all"); setCalendarCourseFilter("All courses / lists"); };
  useEffect(() => {
    const trigger = Array.from(document.querySelectorAll<HTMLButtonElement>(".calendar-filters .control-trigger")).find(button => button.textContent?.trim().startsWith("Filters"));
    if (!trigger) return;
    if (activeFilterCount) trigger.dataset.filterCount = String(activeFilterCount); else delete trigger.dataset.filterCount;
    trigger.setAttribute("aria-label", activeFilterCount ? `Filters, ${activeFilterCount} active` : "Filters");
  }, [activeFilterCount, section, showMoreFilters]);
  const visibleEvents = useMemo(() => allCalendarBlocks.filter(event => {
    const taskState = event.source === "task" ? calendarTaskStatuses.get(event.id) : undefined;
    const overlapCount = calendarConflictCounts.get(event.id) ?? 0;
    const matchesType = itemTypeFilter === "all" || event.source === itemTypeFilter;
    const matchesHealth = scheduleHealthFilter === "all" || (scheduleHealthFilter === "conflicts" ? overlapCount > 0 : overlapCount === 0);
    const matchesPriority = calendarPriorityFilter === "all" || event.priority === "high";
    const matchesRoutine = routineFilter === "all" || (routineFilter === "recurring" ? Boolean(event.repeat && event.repeat !== "none") : !event.repeat || event.repeat === "none");
    const matchesTaskStatus = calendarTaskStatusFilter === "all" || (calendarTaskStatusFilter === "completed" ? taskState === "done" : taskState === calendarTaskStatusFilter);
    const matchesCourse = calendarCourseFilter === "All courses / lists" || event.course === calendarCourseFilter;
    return event.title.toLowerCase().includes(search.toLowerCase()) && (filter === "all" || event.source === filter) && matchesType && matchesHealth && matchesPriority && matchesRoutine && matchesTaskStatus && matchesCourse && event.endAt >= activeStart && event.startAt < activeEnd;
  }).sort((a, b) => a.startAt.getTime() - b.startAt.getTime()), [activeEnd, activeStart, allCalendarBlocks, calendarConflictCounts, calendarCourseFilter, calendarPriorityFilter, calendarTaskStatuses, calendarTaskStatusFilter, filter, itemTypeFilter, routineFilter, scheduleHealthFilter, search]);
  const selectedEvents = visibleEvents.filter(event => sameDay(event.startAt, selectedDate));
  const selectedTasks = tasks.filter(task => sameDay(task.dueAt, selectedDate));
  const pendingTaskCount = tasks.filter(task => !isTaskComplete(task)).length;
  const upcoming = [...allCalendarBlocks, ...tasks.filter(task => !isTaskScheduled(task)).map(task => ({ id: `due-${task.id}`, title: task.title, startAt: task.dueAt, endAt: task.dueAt, source: "task" as const, priority: task.priority }))].filter(event => event.endAt >= new Date()).sort((a, b) => a.startAt.getTime() - b.startAt.getTime()).slice(0, 6);
  const todayTasks = useMemo(() => tasks.filter(task => sameDay(task.dueAt, new Date())), [tasks]);
  const completedTasks = useMemo(() => tasks.filter(isTaskComplete), [tasks]);
  const overdueTasks = useMemo(() => tasks.filter(task => taskDueState(task) === "overdue"), [tasks]);
  const upcomingTaskCount = useMemo(() => tasks.filter(task => !isTaskComplete(task) && taskDueState(task) === "upcoming" && task.dueAt < addDays(new Date(), 8)).length, [tasks]);
  const taskLists = useMemo(() => ["All lists", ...Array.from(new Set(tasks.map(task => task.course || "General"))).sort()], [tasks]);
  const todoTasks = useMemo(() => sortTodoTasks(tasks.filter(task => {
    const state = taskDueState(task);
    const matchesFilter = todoFilter === "all" || (todoFilter === "completed" ? state === "completed" : state === todoFilter);
    const matchesList = todoListFilter === "All lists" || task.course === todoListFilter;
    return matchesFilter && matchesList;
  }), todoSort), [tasks, todoFilter, todoListFilter, todoSort]);
  const listProgress = useMemo(() => taskLists.filter(list => list !== "All lists").map(list => { const listTasks = tasks.filter(task => task.course === list); const done = listTasks.filter(isTaskComplete).length; return { list, total: listTasks.length, done, percent: listTasks.length ? Math.round((done / listTasks.length) * 100) : 0 }; }), [taskLists, tasks]);
  const weekActivity = useMemo(() => weeklyActivity(tasks, plannerBlocks), [plannerBlocks, tasks]);
  const weeklyCompletedTasks = useMemo(() => weekActivity.reduce((total, day) => total + day.completedTasks, 0), [weekActivity]);
  const weeklyFocusMinutes = useMemo(() => weekActivity.reduce((total, day) => total + day.focusMinutes, 0), [weekActivity]);
  const onTimeStats = useMemo(() => onTimeCompletionStats(tasks), [tasks]);
  const recentCompletions = useMemo(() => recentCompletedTasks(tasks), [tasks]);
  const selectedDayComplete = tasks.filter(task => sameDay(task.dueAt, selectedDate) && isTaskComplete(task)).length;
  const dailyQuote = useMemo(() => dailyQuoteForDate(new Date()), []);
  const activeTask = activeTimer ? tasks.find(task => task.id === activeTimer.taskId) : null;
  const activeElapsed = activeTimer ? activeTimer.accumulatedSeconds + (activeTimer.startedAt ? Math.max(0, Math.floor((timerNow - activeTimer.startedAt) / 1000)) : 0) : 0;

  const goToday = () => { const today = new Date(); setCursor(monthStart(today)); setSelectedDate(today); closePopovers(); setToast("Back to today."); };
  const changeCursor = (amount: number) => { closePopovers(); setCursor(current => addMonths(current, amount)); };
  const changeView = (next: ViewMode) => { closePopovers(); setView(next); };
  const openSection = (next: Section) => { closePopovers(); setSection(next); setShowSidebar(false); };
  const beginPlanning = () => { localStorage.setItem("my-plan-welcome-seen", "true"); openSection("calendar"); setToast("Welcome to MY PLAN. Start with one next action."); };
  const openTour = () => { setTourStep(0); setShowTour(true); };
  const closeTour = (message = "Tutorial dismissed. You can return to Welcome any time.") => { setShowTour(false); setToast(message); };
  const retireWelcome = (message: string) => { localStorage.setItem("my-plan-tour-complete", "true"); localStorage.setItem("my-plan-welcome-retired", "true"); localStorage.setItem("my-plan-welcome-seen", "true"); setWelcomeRetired(true); setShowTour(false); setSection("calendar"); setToast(message); };
  const moveTour = (direction: 1 | -1) => { const next = tourStep + direction; if (next >= activeTourSteps.length) return retireWelcome("Tour complete. Welcome is now out of your way."); setTourStep(next); openSection(activeTourSteps[next].section); };
  const returnHome = () => { goToday(); openSection("calendar"); };
  const openDateJump = () => { cancelPopoverDismissal(); setJumpMonth(String(cursor.getMonth() + 1)); setJumpYear(String(cursor.getFullYear())); setShowDateJump(value => !value); setShowFilterMenu(false); };
  const applyDateJump = () => { const month = Number(jumpMonth); const year = Number(jumpYear); if (month < 1 || month > 12 || year < 1900 || year > 2200) return setToast("Enter a month from 1–12 and a year from 1900–2200."); const next = new Date(year, month - 1, 1); setCursor(next); setSelectedDate(next); closePopovers(); setToast(`Showing ${formatMonth(next)}.`); };
  const resetDraft = (kind: ComposerKind, date = selectedDate) => { setComposerKind(kind); setEditingId(null); setDraftTitle(""); setDraftDate(dateKey(date)); setDraftTime(kind === "block" ? "19:00" : "09:00"); setDraftDuration("60"); setDraftRepeat("none"); setDraftPriority("normal"); setDraftCourse(""); setDraftNotes(""); setDraftScheduleTask(true); };
  const openComposerForDate = (kind: ComposerKind, date: Date) => { closePopovers(); setDateContextMenu(null); setMobileDateAction(null); setSelectedDate(date); setCursor(monthStart(date)); setSection("calendar"); resetDraft(kind, date); setShowComposer(true); };
  const openComposer = (kind: ComposerKind) => { openComposerForDate(kind, selectedDate); };
  const closeComposer = () => { setShowComposer(false); setEditingId(null); setRecurringEditTarget(null); };
  const announceConflicts = (title: string, candidate: PlannerBlock, additional: PlannerBlock[] = []) => {
    const conflicts = findTimeConflicts(candidate, [...allCalendarBlocks, ...additional]);
    if (!conflicts.length) return false;
    setConflictNotice({ title, conflicts: conflicts.slice(0, 4).map(conflict => ({ title: conflict.item.title, source: conflict.item.source, overlapMinutes: conflict.overlapMinutes })) });
    return true;
  };
  const saveComposer = () => {
    if (!draftTitle.trim()) return setToast("Add a title before saving.");
    const startAt = readDraftDate(draftDate, draftTime);
    const duration = Math.max(15, Math.min(720, Number(draftDuration) || 60));
    if (!startAt) return setToast("Use a date in YYYY-MM-DD format and a valid time.");
    if (composerKind === "block") {
      const next: PlannerBlock = { id: editingId ?? `plan-${Date.now()}`, title: draftTitle.trim(), startAt, endAt: new Date(startAt.getTime() + duration * 60000), source: "planner", priority: draftPriority, repeat: draftRepeat, repeatUntil: draftRepeat === "none" ? null : addMonths(startAt, 6), completed: false, checklist: [] };
      if (recurringEditTarget) {
        const rootId = recurringEditTarget.id.split(":")[0];
        setPlannerBlocks(current => [...current.map(block => block.id === rootId ? excludeRecurringDate(block, recurringEditTarget.startAt) : block), next]);
        setRecurringEditTarget(null);
      } else setPlannerBlocks(current => editingId ? current.map(block => block.id === editingId ? { ...next, completed: block.completed, excludedDates: block.excludedDates } : block) : [...current, next]);
      const overlaps = announceConflicts(next.title, next);
      setToast(`${recurringEditTarget ? `Updated ${formatShort(recurringEditTarget.startAt)} only for “${next.title}”.` : editingId ? `Updated “${next.title}”.` : `Added “${next.title}” to your ongoing plan.`}${overlaps ? " Overlap found—review it below." : ""}`);
    }
    if (composerKind === "event") {
      const next: PersonalEvent = { id: editingId ?? `event-${Date.now()}`, title: draftTitle.trim(), startAt, endAt: new Date(startAt.getTime() + duration * 60000), priority: draftPriority, course: draftCourse.trim() || "Personal", notes: draftNotes.trim() };
      setPersonalEvents(current => editingId ? current.map(event => event.id === editingId ? next : event) : [...current, next]);
      const overlaps = announceConflicts(next.title, { ...next, source: "event" });
      setToast(`${editingId ? `Updated “${next.title}”.` : `Added event “${next.title}”.`}${overlaps ? " Overlap found—review it below." : ""}`);
    }
    if (composerKind === "task") {
      const next: PlanTask = { id: editingId ?? `task-${Date.now()}`, title: draftTitle.trim(), dueAt: startAt, priority: draftPriority, course: draftCourse.trim() || "General", notes: draftNotes.trim(), completed: false, status: "open", createdAt: new Date(), completedAt: null, scheduledStartAt: draftScheduleTask ? startAt : null, durationMinutes: duration };
      setTasks(current => editingId ? current.map(task => task.id === editingId ? { ...next, completed: task.completed, status: taskStatus(task), createdAt: task.createdAt ?? next.createdAt, completedAt: task.completedAt ?? null } : task) : [...current, next]);
      const overlaps = draftScheduleTask && announceConflicts(next.title, { id: next.id, title: next.title, startAt, endAt: taskEndAt(next), source: "task", priority: next.priority });
      setToast(`${editingId ? `Updated “${next.title}”.` : draftScheduleTask ? `Added and scheduled “${next.title}”.` : `Added “${next.title}” to your task list.`}${overlaps ? " Overlap found—review it below." : ""}`);
    }
    closeComposer();
  };
  const openBlockEditor = (block: PlannerBlock, occurrenceOnly = false) => { const id = occurrenceOnly ? null : block.id.split(":")[0]; const base = occurrenceOnly ? block : plannerBlocks.find(item => item.id === id); if (!base) return; setComposerKind("block"); setEditingId(id); setDraftTitle(base.title); setDraftDate(dateKey(base.startAt)); setDraftTime(timeInputValue(base.startAt)); setDraftDuration(String(Math.max(15, Math.round((base.endAt.getTime() - base.startAt.getTime()) / 60000)))); setDraftRepeat(occurrenceOnly ? "none" : base.repeat ?? "none"); setDraftPriority(base.priority ?? "normal"); setDraftCourse(""); setDraftNotes(""); setShowComposer(true); };
  const editBlock = (event: PlannerBlock) => { if (event.repeat && event.repeat !== "none") { setRecurringEditTarget(event); return; } openBlockEditor(event); };
  const editEvent = (id: string) => { const event = personalEvents.find(item => item.id === id); if (!event) return; setComposerKind("event"); setEditingId(id); setDraftTitle(event.title); setDraftDate(dateKey(event.startAt)); setDraftTime(timeInputValue(event.startAt)); setDraftDuration(String(Math.max(15, Math.round((event.endAt.getTime() - event.startAt.getTime()) / 60000)))); setDraftPriority(event.priority); setDraftCourse(event.course); setDraftNotes(event.notes); setShowComposer(true); };
  const editTask = (id: string) => { const task = tasks.find(item => item.id === id); if (!task) return; const date = task.scheduledStartAt ?? task.dueAt; setComposerKind("task"); setEditingId(id); setDraftTitle(task.title); setDraftDate(dateKey(task.dueAt)); setDraftTime(timeInputValue(date)); setDraftDuration(String(task.durationMinutes ?? 60)); setDraftPriority(task.priority); setDraftCourse(task.course); setDraftNotes(task.notes); setDraftScheduleTask(Boolean(task.scheduledStartAt)); setShowComposer(true); };
  const toggleComplete = (event: PlannerBlock) => { const id = event.id.split(":")[0]; setPlannerBlocks(current => current.map(block => block.id === id ? { ...block, completed: !block.completed } : block)); };
  const toggleTaskComplete = (id: string) => { setTasks(current => current.map(task => task.id === id ? { ...task, completed: !isTaskComplete(task), status: isTaskComplete(task) ? "open" : "done", completedAt: isTaskComplete(task) ? null : new Date() } : task)); setActiveTimer(current => current?.taskId === id ? null : current); };
  const setTaskWorkState = (id: string, status: TaskStatus) => { setTasks(current => current.map(task => task.id === id ? { ...task, status, completed: status === "done", completedAt: status === "done" ? new Date() : null } : task)); if (status === "in-progress") { setActiveTimer(current => current?.taskId === id ? { ...current, startedAt: current.startedAt ?? Date.now() } : { taskId: id, accumulatedSeconds: 0, startedAt: Date.now() }); setTimerNow(Date.now()); } if (status === "done") setActiveTimer(current => current?.taskId === id ? null : current); setToast(status === "in-progress" ? "Focus timer started." : status === "done" ? "Task marked complete." : "Task reopened."); };
  const requestBulkComplete = () => { const ids = todoTasks.filter(task => !isTaskComplete(task)).map(task => task.id); if (!ids.length) { setToast("There are no open tasks in this view to complete."); return; } setBulkCompleteTaskIds(ids); };
  const confirmBulkComplete = () => { if (!bulkCompleteTaskIds?.length) return; const ids = new Set(bulkCompleteTaskIds); setTasks(current => current.map(task => ids.has(task.id) ? { ...task, completed: true, status: "done", completedAt: new Date() } : task)); setActiveTimer(current => current && ids.has(current.taskId) ? null : current); setToast(`${bulkCompleteTaskIds.length} visible task${bulkCompleteTaskIds.length === 1 ? "" : "s"} marked complete.`); setBulkCompleteTaskIds(null); };
  const pauseTimer = () => { setActiveTimer(current => { if (!current?.startedAt) return current; return { ...current, accumulatedSeconds: current.accumulatedSeconds + Math.max(0, Math.floor((Date.now() - current.startedAt) / 1000)), startedAt: null }; }); setToast("Focus timer paused."); };
  const resumeTimer = () => { setActiveTimer(current => current ? { ...current, startedAt: Date.now() } : current); setTimerNow(Date.now()); setToast("Focus timer resumed."); };
  const finishTimer = () => { if (!activeTimer) return; setTaskWorkState(activeTimer.taskId, "done"); setActiveTimer(null); setToast("Focus session finished and task completed."); };
  const openDateContextMenu = (event: React.MouseEvent<HTMLButtonElement>, date: Date) => { event.preventDefault(); setSelectedDate(date); setDateContextMenu({ date, x: Math.min(event.clientX, window.innerWidth - 238), y: Math.min(event.clientY, window.innerHeight - 196) }); };
  const handleDateTap = (event: React.MouseEvent<HTMLButtonElement>, date: Date) => {
    const now = Date.now();
    const key = dateKey(date);
    const previousTap = lastMobileDateTap.current;
    const isDoubleTap = isMobileViewport && previousTap?.key === key && now - previousTap.at < 360;
    if (isDoubleTap) {
      event.preventDefault();
      lastMobileDateTap.current = null;
      setSelectedDate(date);
      setDateContextMenu(null);
      setMobileDateAction(date);
      navigator.vibrate?.(8);
      setToast(`Quick planning actions for ${formatShort(date)}.`);
      return;
    }
    lastMobileDateTap.current = { key, at: now };
    setSelectedDate(date);
    setDateContextMenu(null);
  };
  const scheduleTask = (id: string) => { setTasks(current => current.map(task => task.id === id ? { ...task, scheduledStartAt: task.scheduledStartAt ?? new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 9), durationMinutes: task.durationMinutes ?? 60 } : task)); setToast("Task scheduled on the selected day."); };
  const duplicateBlock = (event: PlannerBlock) => { const id = event.id.split(":")[0]; const base = plannerBlocks.find(block => block.id === id); if (!base) return; const next = { ...base, id: `plan-${Date.now()}`, title: `${base.title} — copy`, startAt: addDays(base.startAt, 1), endAt: addDays(base.endAt, 1), completed: false }; setPlannerBlocks(current => [...current, next]); setToast("Study block duplicated for tomorrow."); };
  const duplicateEvent = (id: string) => { const base = personalEvents.find(event => event.id === id); if (!base) return; const next = { ...base, id: `event-${Date.now()}`, title: `${base.title} — copy`, startAt: addDays(base.startAt, 1), endAt: addDays(base.endAt, 1) }; setPersonalEvents(current => [...current, next]); setToast("Event duplicated for tomorrow."); };
  const rescheduleBlock = (event: PlannerBlock) => { const id = event.id.split(":")[0]; setPlannerBlocks(current => current.map(block => block.id === id ? { ...block, startAt: addDays(block.startAt, 1), endAt: addDays(block.endAt, 1) } : block)); setToast("Study block moved forward by one day."); };
  const rescheduleEvent = (id: string) => { setPersonalEvents(current => current.map(event => event.id === id ? { ...event, startAt: addDays(event.startAt, 1), endAt: addDays(event.endAt, 1) } : event)); setToast("Event moved forward by one day."); };
  const rescheduleTask = (id: string) => { setTasks(current => current.map(task => task.id === id ? { ...task, dueAt: addDays(task.dueAt, 1), scheduledStartAt: task.scheduledStartAt ? addDays(task.scheduledStartAt, 1) : null } : task)); setToast("Task moved forward by one day."); };
  const deleteBlock = (event: PlannerBlock) => { if (event.repeat && event.repeat !== "none") { setRecurringRemovalTarget(event); return; } const id = event.id.split(":")[0]; setPlannerBlocks(current => current.filter(block => block.id !== id)); setToast("Study block removed."); };
  const removeSelectedRecurringDate = () => { if (!recurringRemovalTarget) return; const id = recurringRemovalTarget.id.split(":")[0]; const removedDate = dateKey(recurringRemovalTarget.startAt); setPlannerBlocks(current => current.map(block => block.id === id ? { ...block, excludedDates: Array.from(new Set([...(block.excludedDates ?? []), removedDate])) } : block)); setRecurringRemovalTarget(null); setToast(`Removed ${formatShort(recurringRemovalTarget.startAt)} only. The rest of the routine remains.`); };
  const removeRecurringSeries = () => { if (!recurringRemovalTarget) return; const id = recurringRemovalTarget.id.split(":")[0]; setPlannerBlocks(current => current.filter(block => block.id !== id)); setRecurringRemovalTarget(null); setToast("Recurring routine series removed."); };
  const deleteEvent = (id: string) => { setPersonalEvents(current => current.filter(event => event.id !== id)); setToast("Event removed."); };
  const deleteTask = (id: string) => { setTasks(current => current.filter(task => task.id !== id)); setToast("Task removed."); };
  const chooseImportFile = (file?: File) => {
    if (!file) return;
    if (!isAuthenticated) { setImportMessage("Sign in before importing so this schedule stays in your private MY PLAN workspace."); return; }
    if (file.size > 10 * 1024 * 1024) { setImportMessage("Choose a file smaller than 10 MB."); return; }
    setImportFileName(file.name);
    setImportMessage(`Scanning ${file.name}…`);
    const reader = new FileReader();
    reader.onerror = () => setImportMessage("The file could not be read on this device.");
    reader.onload = () => {
      const payload = typeof reader.result === "string" ? reader.result.split(",").pop() || "" : "";
      if (!payload) { setImportMessage("The selected file was empty or could not be read."); return; }
      extractSchedule.mutate({ fileName: file.name, mimeType: file.type || "application/octet-stream", contentBase64: payload });
    };
    reader.readAsDataURL(file);
  };
  const updateImportCandidate = (id: string, update: Partial<ImportCandidate>) => {
    if (typeof update.date === "string" && update.date && !isValidImportDate(update.date)) {
      setImportMessage("Date needs the exact YYYY-MM-DD format and must be a real calendar day before it can be added.");
    } else if (typeof update.date === "string" && isValidImportDate(update.date)) {
      setImportMessage("Date accepted. You can now select this suggestion for import.");
    }
    setImportCandidates(current => current.map(candidate => candidate.id === id ? { ...candidate, ...update } : candidate));
  };
  const importScheduleCandidates = (selected: ImportCandidate[], weeklyRepeatUntil?: string) => {
    const { ready, skipped, blocks: importedBlocks, events: importedEvents, tasks: importedTasks } = mapSelectedImportCandidates(selected, Date.now(), weeklyRepeatUntil);
    if (!ready.length) { setImportMessage("Select at least one item and enter a real date in YYYY-MM-DD format before adding it."); return false; }
    setPlannerBlocks(current => [...current, ...importedBlocks]);
    setPersonalEvents(current => [...current, ...importedEvents]);
    setTasks(current => [...current, ...importedTasks]);
    const importedTimed = [...importedBlocks, ...importedEvents.map(event => ({ ...event, source: "event" as const })), ...importedTasks.filter(task => task.scheduledStartAt).map(task => ({ id: task.id, title: task.title, startAt: task.scheduledStartAt!, endAt: taskEndAt(task), source: "task" as const, priority: task.priority }))];
    const firstImportedConflict = importedTimed.find(item => announceConflicts(item.title, item));
    setLastAutoImportIds({ blockIds: importedBlocks.map(item => item.id), eventIds: importedEvents.map(item => item.id), taskIds: importedTasks.map(item => item.id) });
    const importedIds = new Set(ready.map(candidate => candidate.id));
    setImportCandidates(current => current.filter(candidate => !importedIds.has(candidate.id)));
    setImportMessage(`${ready.length} selected item${ready.length === 1 ? "" : "s"} added to your private MY PLAN workspace.${firstImportedConflict ? " Overlaps were found; review them before relying on the new schedule." : ""}${skipped ? ` ${skipped} selected candidate${skipped === 1 ? " needs" : "s need"} a complete date before it can be added.` : ""} Blank times use 9:00 AM.`);
    setToast(`Imported ${ready.length} selected plan item${ready.length === 1 ? "" : "s"}. Undo is available below.`);
    return true;
  };
  const addApprovedImportCandidates = (weeklyStart?: string, weeklyEnd?: string) => {
    const selected = importCandidates.filter(candidate => candidate.approved);
    const hasWeeklyRoutine = selected.some(candidate => candidate.weekdays?.length);
    if (!selected.length) { setImportMessage("Select at least one suggestion before adding it to MY PLAN."); return false; }
    if (hasWeeklyRoutine && (!isValidImportDate(weeklyStart || "") || !isValidImportDate(weeklyEnd || ""))) {
      setImportMessage("Choose real start and repeat-until dates before adding a weekly routine.");
      return false;
    }
    if (hasWeeklyRoutine && weeklyEnd! < weeklyStart!) {
      setImportMessage("The repeat-until date must be on or after the routine start date.");
      return false;
    }
    return importScheduleCandidates(selected.map(candidate => candidate.weekdays?.length ? { ...candidate, date: weeklyStart! } : candidate), weeklyEnd);
  };
  const setAllImportCandidatesApproved = (approved: boolean) => setImportCandidates(current => current.map(candidate => ({ ...candidate, approved })));
  const undoLastAutomaticImport = () => {
    const rollback = lastAutoImportIds || inferredLastImportIds;
    if (!rollback) return;
    const blockIds = new Set(rollback.blockIds); const eventIds = new Set(rollback.eventIds); const taskIds = new Set(rollback.taskIds);
    setPlannerBlocks(current => current.filter(item => !blockIds.has(item.id)));
    setPersonalEvents(current => current.filter(item => !eventIds.has(item.id)));
    setTasks(current => current.filter(item => !taskIds.has(item.id)));
    setLastAutoImportIds(null);
    setImportMessage("The most recent automatic import was removed from this private workspace.");
    setToast("Automatic import undone.");
  };

  const renderTask = (task: PlanTask) => <article key={task.id} className={`ongoing-event source-task task-card ${isTaskComplete(task) ? "is-complete" : ""} ${activeTimer?.taskId === task.id ? "is-timed" : ""}`}><div className="event-meta"><span>Task · {task.course} · {taskStatus(task).replace("-", " ")}</span>{task.priority === "high" ? <Star size={12} fill="currentColor" /> : null}</div><strong>{task.title}</strong><small>{task.scheduledStartAt ? `${displayTime(task.scheduledStartAt)} · ${task.durationMinutes ?? 60} min` : "Unscheduled"} · due {formatShort(task.dueAt)}</small>{task.notes ? <small className="item-notes">{task.notes}</small> : null}<div className="event-tools">{!isTaskComplete(task) && taskStatus(task) === "open" ? <button onClick={() => setTaskWorkState(task.id, "in-progress")}><Play size={12} /> Start</button> : null}{!isTaskComplete(task) && !task.scheduledStartAt ? <button onClick={() => scheduleTask(task.id)}><CalendarDays size={12} /> Schedule</button> : null}<button onClick={() => toggleTaskComplete(task.id)}><Check size={13} /> {isTaskComplete(task) ? "Reopen" : "Done"}</button><button onClick={() => editTask(task.id)}><Edit3 size={12} /> Edit</button><button onClick={() => rescheduleTask(task.id)}>+1 day</button><button onClick={() => deleteTask(task.id)}><Trash2 size={12} /> Remove</button></div></article>;
  const renderEvent = (event: PlannerBlock, compact = false) => {
    const kind = event.source === "academic" ? "Academic" : event.source === "linked" ? "Linked" : event.source === "event" ? "My event" : event.source === "task" ? "Scheduled task" : "Study block";
    const details = event.source === "task" ? `${displayTime(event.startAt)} · ${Math.max(15, Math.round((event.endAt.getTime() - event.startAt.getTime()) / 60000))} min` : `${displayTime(event.startAt)} · ${event.repeat && event.repeat !== "none" ? `${event.repeat} routine` : "one time"}`;
    const conflictCount = calendarConflictCounts.get(event.id) ?? 0;
    const filterReasons = calendarFilterReasons(event, { source: filter, itemType: itemTypeFilter, scheduleHealth: scheduleHealthFilter, priority: calendarPriorityFilter, routine: routineFilter, taskStatus: calendarTaskStatusFilter, course: calendarCourseFilter }, conflictCount, event.source === "task" ? calendarTaskStatuses.get(event.id) : undefined);
    return <article key={event.id} className={`ongoing-event source-${event.source} ${event.completed ? "is-complete" : ""}`}><div className="event-meta"><span>{kind}{event.source === "event" && event.course ? ` · ${event.course}` : ""}</span>{event.priority === "high" ? <Star size={12} fill="currentColor" /> : null}{conflictCount ? <em>{conflictCount} overlap{conflictCount === 1 ? "" : "s"}</em> : null}</div><strong>{event.title}</strong><small>{details}</small>{filterReasons.length ? <div className="filter-reason-badges" aria-label={`Matched filters: ${filterReasons.join(", ")}`}>{filterReasons.map(reason => <span key={reason}>{reason}</span>)}</div> : null}{event.source === "event" && event.notes ? <small className="item-notes">{event.notes}</small> : null}{!compact && event.source === "planner" ? <div className="event-tools"><button onClick={() => toggleComplete(event)}><Check size={13} /> {event.completed ? "Reopen" : "Done"}</button><button onClick={() => editBlock(event)}><Edit3 size={12} /> Edit</button><button onClick={() => duplicateBlock(event)}>Copy</button><button onClick={() => rescheduleBlock(event)}>+1 day</button><button onClick={() => deleteBlock(event)}><Trash2 size={12} /> Remove</button></div> : null}{!compact && event.source === "event" ? <div className="event-tools"><button onClick={() => editEvent(event.id)}><Edit3 size={12} /> Edit</button><button onClick={() => duplicateEvent(event.id)}>Copy</button><button onClick={() => rescheduleEvent(event.id)}>+1 day</button><button onClick={() => deleteEvent(event.id)}>Remove</button></div> : null}{!compact && event.source === "task" ? <div className="event-tools"><button onClick={() => toggleTaskComplete(event.id)}><Check size={13} /> {event.completed ? "Reopen" : "Done"}</button><button onClick={() => editTask(event.id)}><Edit3 size={12} /> Edit</button><button onClick={() => rescheduleTask(event.id)}>+1 day</button><button onClick={() => deleteTask(event.id)}>Remove</button></div> : null}</article>;
  };

  const selectedDateLabel = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(selectedDate);
  if (loading) return <BrandLoader label="Opening your workspace…" />;
  return <div className={`ongoing-shell ${sidebarCollapsed ? "is-sidebar-collapsed" : ""}`}>
    {showSidebar ? <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setShowSidebar(false)} /> : null}
    <aside className={`ongoing-sidebar ${showSidebar ? "is-open" : ""} ${sidebarCollapsed ? "is-collapsed" : ""}`}><button className="brand-line" onClick={returnHome} aria-label="Return to MY PLAN home"><div className="tab-mark"><img src={MY_PLAN_LOGO_URL} alt="" /></div><div><span>Your clear plan</span><strong>MY PLAN</strong></div></button><div className="side-nav">{!welcomeRetired ? <button className={section === "welcome" ? "active" : ""} onClick={() => openSection("welcome")}><BookOpenCheck size={17} /> Welcome</button> : null}<button className={section === "calendar" ? "active" : ""} onClick={() => openSection("calendar")}><CalendarDays size={17} /> Calendar</button><button className={section === "todo" ? "active" : ""} onClick={() => openSection("todo")}><ListTodo size={17} /> To-do</button><button className={section === "progress" ? "active" : ""} onClick={() => openSection("progress")}><BarChart3 size={17} /> Progress</button><button className={section === "tools" || section === "accounts" || section === "sync" || section === "import" || section === "spark" ? "active" : ""} onClick={() => openSection("tools")}><MoreHorizontal size={17} /> Workspace tools</button>{isAdmin ? <button className={section === "admin" ? "active" : ""} onClick={() => openSection("admin")}><ShieldCheck size={17} /> Admin panel</button> : null}</div><div className="side-footer"><ShieldCheck size={15} /><p>Plan locally first. Sign in only when you want a MY PLAN account or connected services.</p></div></aside>
    <main className="ongoing-main" onPointerDownCapture={event => { const target = event.target as HTMLElement; if (!(target.closest(".control-anchor") || target.closest(".date-context-menu") || target.closest(".mobile-date-sheet"))) { closePopovers(); setDateContextMenu(null); setMobileDateAction(null); } }}><header className="ongoing-topbar"><button className="desktop-sidebar-toggle" onClick={() => setSidebarCollapsed(value => !value)} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>{sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button><button className="mobile-menu" onClick={() => setShowSidebar(value => !value)} aria-label={showSidebar ? "Close navigation" : "Open navigation"} title={showSidebar ? "Close navigation" : "Open navigation"}>{showSidebar ? <X size={19} /> : <Menu size={19} />}</button><span className="toast-line">{toast}</span><div className="top-actions"><button onClick={goToday}><CalendarDays size={15} /> Today</button><button onClick={() => openComposer("task")}><ListTodo size={15} /> Add task</button><button onClick={() => openComposer("event")}><CalendarPlus size={15} /> Add event</button><button className="accent" onClick={() => openComposer("block")}><Plus size={16} /> Add block</button></div></header>
      {section === "welcome" ? <section className="welcome-workspace"><div className="welcome-paper"><p className="kicker"><BookOpenCheck size={15} /> A planner that starts where you are</p><h1>Welcome to<br /><em>MY PLAN.</em></h1><p className="welcome-lede">Capture what matters, decide what fits today, and give your future self one clear next step. Use it locally now; connect an account only when you are ready.</p><div className="welcome-actions"><button className="accent" onClick={beginPlanning}>Start planning <ArrowRight size={16} /></button><button className="welcome-secondary" onClick={openTour}><Sparkles size={15} /> Take the 60-sec tour</button>{!isAuthenticated ? <button className="welcome-secondary" onClick={() => startLogin()}><LogIn size={15} /> Create or sign in</button> : <button className="welcome-secondary" onClick={() => openSection("accounts")}><UserRound size={15} /> View account</button>}</div><div className="welcome-notes"><article><span>01</span><strong>Calendar</strong><p>Turn deadlines, events, and focused work into time you can actually see.</p></article><article><span>02</span><strong>To-do</strong><p>Keep one small, useful list of next actions with their context attached.</p></article><article><span>03</span><strong>Progress</strong><p>See only the work you have really completed—no invented productivity score.</p></article></div></div><aside className="welcome-side"><p className="kicker"><ShieldCheck size={14} /> Your starting point</p><strong>{pendingTaskCount ? `${pendingTaskCount} open task${pendingTaskCount === 1 ? "" : "s"}` : "A clear page"}</strong><p>{upcoming[0] ? `Next: ${upcoming[0].title}` : "Add a task, event, or focused block when you are ready."}</p><button className="welcome-tour-link" onClick={openTour}>How MY PLAN works <ArrowRight size={14} /></button><div className="welcome-checks"><span><Check size={13} /> Local planning works without sign-in</span><span><Check size={13} /> Calendar grows beyond one semester</span><span><Check size={13} /> Google connection stays separate and opt-in</span></div></aside></section> : null}
      {section === "calendar" ? <><section className="ongoing-hero"><div><p className="kicker"><GraduationCap size={15} /> Ongoing calendar</p><h1>Every month ahead.<br />One clear plan.</h1><p>Schedule study blocks, personal events, and next actions in one calm field-notes calendar.</p><blockquote className="daily-quote"><div className="quote-meta"><Sparkles size={14} /><span>Today’s note</span></div><q>{dailyQuote}</q></blockquote></div><div className="hero-stat"><span>Next up</span><strong>{upcoming[0] ? formatShort(upcoming[0].startAt) : "Clear day"}</strong><small>{upcoming[0]?.title || "No upcoming items"}</small><em>{pendingTaskCount} open task{pendingTaskCount === 1 ? "" : "s"}</em></div></section>
      <div className="calendar-layout"><section className="calendar-workbench"><div className="calendar-controls"><div className="cursor-controls"><button onClick={() => changeCursor(-1)} aria-label="Previous month"><ChevronLeft size={18} /></button><h2>{view === "week" ? `${formatShort(activeStart)} — ${formatShort(addDays(activeStart, 6))}` : view === "agenda" ? "Next 30 days" : formatMonth(cursor)}</h2><button onClick={() => changeCursor(1)} aria-label="Next month"><ChevronRight size={18} /></button></div><div className="view-switch">{(["month", "week", "agenda"] as ViewMode[]).map(mode => <button key={mode} className={view === mode ? "active" : ""} onClick={() => changeView(mode)}>{mode}</button>)}</div></div><div className="calendar-filters"><label className="search-field"><Search size={15} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search calendar" /></label><div className="control-anchor" onMouseEnter={cancelPopoverDismissal} onMouseLeave={schedulePopoverDismissal}><button className="control-trigger" aria-expanded={showFilterMenu} onClick={() => { cancelPopoverDismissal(); setShowFilterMenu(value => !value); setShowMoreFilters(false); setShowDateJump(false); }}>{sourceLabel[filter]}</button>{showFilterMenu ? <div className="control-popover filter-popover">{(Object.entries(sourceLabel) as [SourceFilter, string][]).map(([key, label]) => <button key={key} className={filter === key ? "selected" : ""} onClick={() => { setFilter(key); closePopovers(); }}>{label}{filter === key ? <Check size={14} /> : null}</button>)}</div> : null}</div><div className="control-anchor" onMouseEnter={cancelPopoverDismissal} onMouseLeave={schedulePopoverDismissal}><button className="control-trigger" aria-expanded={showMoreFilters} onClick={() => { cancelPopoverDismissal(); setShowMoreFilters(value => !value); setShowFilterMenu(false); setShowDateJump(false); }}>Filters{activeSecondaryFilterCount ? ` · ${activeSecondaryFilterCount}` : ""}</button>{showMoreFilters ? <div className="control-popover advanced-filter-popover"><div className="advanced-filter-heading"><strong>Filter calendar</strong>{activeSecondaryFilterCount ? <button onClick={clearSecondaryFilters}>Clear all</button> : null}</div><label>Item type<select aria-label="Calendar item type filter" value={itemTypeFilter} onChange={event => setItemTypeFilter(event.target.value as ItemTypeFilter)}><option value="all">All item types</option><option value="event">Events</option><option value="planner">Focus blocks</option><option value="task">Scheduled tasks</option></select></label><label>Schedule health<select aria-label="Calendar overlap filter" value={scheduleHealthFilter} onChange={event => setScheduleHealthFilter(event.target.value as ScheduleHealthFilter)}><option value="all">All schedules</option><option value="conflicts">Overlaps only</option><option value="clear">No overlaps</option></select></label><label>Priority<select aria-label="Calendar priority filter" value={calendarPriorityFilter} onChange={event => setCalendarPriorityFilter(event.target.value as PriorityFilter)}><option value="all">Any priority</option><option value="high">High priority</option></select></label><label>Routine<select aria-label="Calendar routine filter" value={routineFilter} onChange={event => setRoutineFilter(event.target.value as RoutineFilter)}><option value="all">One-time + recurring</option><option value="recurring">Recurring only</option><option value="one-time">One-time only</option></select></label><label>Task status<select aria-label="Calendar task status filter" value={calendarTaskStatusFilter} onChange={event => setCalendarTaskStatusFilter(event.target.value as CalendarTaskStatusFilter)}><option value="all">Any task status</option><option value="open">Open tasks</option><option value="in-progress">In-progress tasks</option><option value="completed">Completed tasks</option></select></label><label>Course or list<select aria-label="Calendar course filter" value={calendarCourseFilter} onChange={event => setCalendarCourseFilter(event.target.value)}>{calendarCourses.map(course => <option key={course}>{course}</option>)}</select></label></div> : null}</div><div className="control-anchor" onMouseEnter={cancelPopoverDismissal} onMouseLeave={schedulePopoverDismissal}><button className="control-trigger date-trigger" aria-expanded={showDateJump} onClick={openDateJump}><CalendarDays size={14} /> {formatMonth(cursor)}</button>{showDateJump ? <div className="control-popover date-popover"><p>Jump to a month</p><div><label>Month<input aria-label="Month number" inputMode="numeric" value={jumpMonth} onChange={event => setJumpMonth(event.target.value)} /></label><label>Year<input aria-label="Year number" inputMode="numeric" value={jumpYear} onChange={event => setJumpYear(event.target.value)} /></label></div><div className="popover-actions"><button onClick={closePopovers}>Cancel</button><button className="apply-jump" onClick={applyDateJump}>Show month</button></div></div> : null}</div></div>
      {view === "month" ? <div className="month-view"><div className="weekdays">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => <span key={day}>{day}</span>)}</div><div className="month-board">{daysInMonth(cursor).map((day, index) => !day ? <div className="month-cell blank" key={`blank-${index}`} /> : <button key={dateKey(day)} onClick={event => handleDateTap(event, day)} onContextMenu={event => openDateContextMenu(event, day)} aria-label={`${formatShort(day)}${isMobileViewport ? ". Double-tap for quick planning actions." : ". Right-click for planning actions."}`} className={`month-cell ${sameDay(day, selectedDate) ? "selected" : ""} ${sameDay(day, new Date()) ? "today" : ""}`}><b>{day.getDate()}</b><div>{visibleEvents.filter(event => sameDay(event.startAt, day)).slice(0, 3).map(event => <span className={`dot ${event.source}`} key={event.id} />)}{tasks.filter(task => !isTaskScheduled(task) && sameDay(task.dueAt, day)).slice(0, 2).map(task => <span className="dot task" key={task.id} />)}</div></button>)}</div></div> : null}
      {view === "week" ? <div className="week-view">{Array.from({ length: 7 }, (_, index) => addDays(activeStart, index)).map(day => <section key={dateKey(day)} className={`week-day ${sameDay(day, new Date()) ? "today" : ""}`}><button onClick={() => setSelectedDate(day)}><span>{new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(day)}</span><strong>{day.getDate()}</strong></button>{visibleEvents.filter(event => sameDay(event.startAt, day)).map(event => renderEvent(event, true))}{tasks.filter(task => !isTaskScheduled(task) && sameDay(task.dueAt, day)).map(renderTask)}</section>)}</div> : null}
      {view === "agenda" ? <div className="agenda-view">{visibleEvents.length || tasks.some(task => !isTaskScheduled(task) && task.dueAt >= activeStart && task.dueAt < activeEnd) ? <>{visibleEvents.map(event => <div className="agenda-row" key={event.id}><time>{formatShort(event.startAt)}</time>{renderEvent(event)}</div>)}{tasks.filter(task => !isTaskScheduled(task) && task.dueAt >= activeStart && task.dueAt < activeEnd).map(task => <div className="agenda-row" key={task.id}><time>Due {formatShort(task.dueAt)}</time>{renderTask(task)}</div>)}</> : <p className="empty-agenda">No matching plans in the next 30 days. Add a task, event, or focused study block.</p>}</div> : null}</section>
      <aside className="selected-margin"><div className="margin-heading"><div><p className="kicker"><ListChecks size={14} /> Today’s plan</p><h3>{selectedDateLabel}</h3></div><button className="mini-add" onClick={() => openComposer("task")}><Plus size={14} /> Task</button></div>{selectedEvents.length ? selectedEvents.map(event => renderEvent(event)) : <p className="empty-agenda">Nothing scheduled. Add a focused study block or a personal event.</p>}{selectedTasks.filter(task => !isTaskScheduled(task) || !sameDay(task.scheduledStartAt!, selectedDate)).map(renderTask)}<div className="margin-rule" /><p className="kicker"><Check size={14} /> Progress</p><strong>{selectedDayComplete} completed task{selectedDayComplete === 1 ? "" : "s"} · {blocks.filter(event => sameDay(event.startAt, selectedDate) && event.completed).length} focused block{blocks.filter(event => sameDay(event.startAt, selectedDate) && event.completed).length === 1 ? "" : "s"}</strong></aside></div></> : null}
      {section === "todo" ? <section className="planning-workspace"><header className="workspace-heading"><div><p className="kicker"><ListTodo size={15} /> Next actions</p><h1>To-do, without the pile.</h1><p>Keep every next action in one place. Start it, schedule it, finish it, or move it forward—without losing the useful context.</p></div><button className="accent" onClick={() => openComposer("task")}><Plus size={16} /> Add task</button></header><div className="workspace-metrics"><article><span>Open</span><strong>{pendingTaskCount}</strong><small>next actions</small></article><article><span>Due today</span><strong>{todayTasks.filter(task => !isTaskComplete(task)).length}</strong><small>needs attention</small></article><article><span>Overdue</span><strong>{overdueTasks.length}</strong><small>reschedule or finish</small></article><article><span>Next 7 days</span><strong>{upcomingTaskCount}</strong><small>upcoming deadlines</small></article></div><div className="todo-toolbar"><div className="todo-filter-row">{(["all", "today", "upcoming", "overdue", "completed"] as TodoFilter[]).map(next => <button key={next} className={todoFilter === next ? "active" : ""} onClick={() => setTodoFilter(next)}>{next === "all" ? "All" : next}</button>)}</div><div className="todo-list-row">{taskLists.map(list => <button key={list} className={todoListFilter === list ? "active" : ""} onClick={() => setTodoListFilter(list)}>{list}</button>)}</div><div className="todo-triage-row"><label>Sort<select aria-label="To-do sort order" value={todoSort} onChange={event => setTodoSort(event.target.value as TodoSort)}><option value="due">Due date</option><option value="priority">High priority first</option><option value="newest">Newest first</option></select></label><button className="complete-visible" onClick={requestBulkComplete}><Check size={14} /> Complete visible</button></div></div><div className="todo-list"><div className="todo-list-heading"><strong>{todoListFilter} · {todoFilter}</strong><span>{todoTasks.length} item{todoTasks.length === 1 ? "" : "s"}</span></div>{todoTasks.length ? todoTasks.map(renderTask) : <div className="todo-empty"><ListChecks size={22} /><strong>No matching tasks.</strong><p>Change the filters or capture the next action that is on your mind.</p><button onClick={() => openComposer("task")}>Add a task</button></div>}</div></section> : null}
      {section === "progress" ? <section className="planning-workspace progress-workspace"><header className="workspace-heading"><div><p className="kicker"><BarChart3 size={15} /> Honest progress</p><h1>Notice the work that moved.</h1><p>MY PLAN only counts completed tasks and focus blocks. No arbitrary score, no streak pressure—just the work you recorded.</p></div><button onClick={() => openSection("todo")}><ListTodo size={15} /> Review tasks</button></header><div className="progress-summary"><article className="progress-feature"><span>Today</span><strong>{todayTasks.filter(isTaskComplete).length} / {todayTasks.length}</strong><p>tasks complete today</p><div className="progress-track"><i style={{ width: `${todayTasks.length ? Math.round((todayTasks.filter(isTaskComplete).length / todayTasks.length) * 100) : 0}%` }} /></div></article><article><span>Completed</span><strong>{completedTasks.length}</strong><p>tasks in your plan</p></article><article><span>Focus blocks</span><strong>{blocks.filter(block => block.completed && block.startAt >= addDays(new Date(), -6)).length}</strong><p>completed this week</p></article><article><span>Upcoming</span><strong>{upcomingTaskCount}</strong><p>deadlines in 7 days</p></article></div><section className="week-activity"><div className="list-progress-heading"><div><p className="kicker"><BarChart3 size={14} /> Seven-day record</p><h2>What you completed and focused</h2></div><span>{weeklyCompletedTasks} task{weeklyCompletedTasks === 1 ? "" : "s"} · {weeklyFocusMinutes} min focused</span></div><p>Each day reflects only completed tasks with a saved completion time and focus blocks you marked done.</p><div className="week-activity-grid">{weekActivity.map(day => <article key={dateKey(day.date)}><time>{new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(day.date)}</time><strong>{day.completedTasks}</strong><span>task{day.completedTasks === 1 ? "" : "s"}</span><small>{day.focusMinutes ? `${day.focusMinutes} min focus` : "—"}</small></article>)}</div></section><section className="completion-insights"><article><p className="kicker"><Check size={14} /> Due-date record</p><h2>Finished on time</h2><strong>{onTimeStats.onTime} / {onTimeStats.timestamped}</strong><p>{onTimeStats.timestamped ? "completed tasks were finished by their recorded due time." : "This appears once a completed task has a saved completion time."}</p></article><article><p className="kicker"><ListChecks size={14} /> Recent completions</p><h2>Proof of progress</h2>{recentCompletions.length ? <ul>{recentCompletions.map(task => <li key={task.id}><span><b>{task.title}</b><small>{task.course}</small></span><time>{formatShort(task.completedAt!)}</time></li>)}</ul> : <p>Complete a task to create a dated record here.</p>}</article></section><section className="list-progress"><div className="list-progress-heading"><div><p className="kicker"><ListChecks size={14} /> List progress</p><h2>Where your effort is going</h2></div><span>{listProgress.length} active list{listProgress.length === 1 ? "" : "s"}</span></div>{listProgress.length ? listProgress.map(list => <article key={list.list}><div><strong>{list.list}</strong><span>{list.done} of {list.total} complete</span></div><div className="progress-track"><i style={{ width: `${list.percent}%` }} /></div><b>{list.percent}%</b></article>) : <div className="todo-empty"><BarChart3 size={22} /><strong>Progress starts with one task.</strong><p>Add a task to see real list and daily completion signals here.</p><button onClick={() => openComposer("task")}>Add a task</button></div>}</section></section> : null}
      {section === "tools" ? <section className="workspace-card tools-workspace"><p className="kicker"><MoreHorizontal size={15} /> Workspace tools</p><h1>Connected tools, kept out of the way.</h1><p>Daily planning stays focused in the main menu. Open a tool only when you need to connect accounts, import a schedule, check sync, or work with Gemini Spark.</p><div className="tools-grid"><button className="tool-card" onClick={() => openSection("accounts")}><CirclePlus size={19} /><span><strong>Account center</strong><small>Sign in, connect Google, and select your calendars.</small></span><ArrowRight size={16} /></button><button className="tool-card" onClick={() => openSection("sync")}><RefreshCw size={19} /><span><strong>Sync center</strong><small>Check connection health and Google Calendar reminders.</small></span><ArrowRight size={16} /></button><button className="tool-card" onClick={() => openSection("import")}><Upload size={19} /><span><strong>Import schedule</strong><small>Scan a PDF, image, document, spreadsheet, CSV, or ICS file.</small></span><ArrowRight size={16} /></button><button className="tool-card" onClick={() => openSection("spark")}><Sparkles size={19} /><span><strong>Gemini Spark</strong><small>Use the safe MCP endpoint for calendar-aware research context.</small></span><ArrowRight size={16} /></button></div><aside className="tools-note"><ShieldCheck size={17} /><span>Connections and imports stay private to the MY PLAN account that owns them. Administrator controls remain in their own protected panel.</span></aside></section> : null}
      {section === "accounts" ? <section className="workspace-card account-workspace"><p className="kicker"><CirclePlus size={15} /> Your planning identity</p><h1>Account & connections</h1><p>MY PLAN remains useful offline and locally. Sign in only when you want the account foundation required for connected calendar services.</p>{loading ? <div className="account-state"><span>Checking account…</span></div> : !isAuthenticated ? <div className="account-state signed-out"><UserRound size={22} /><div><strong>Plan locally, or make it yours everywhere.</strong><span>A MY PLAN account keeps connected services tied to you; it is not required to start planning.</span></div><button className="accent" onClick={() => startLogin()}><LogIn size={15} /> Create or sign in</button></div> : <div className="account-state signed-in"><UserRound size={22} /><div><strong>{user?.name || "MY PLAN account"}</strong><span>{user?.email || "Signed in and ready for connected services"}</span></div><button onClick={() => void logout()}><LogOut size={14} /> Sign out</button></div>}{isAdmin ? <aside className="admin-status" aria-label="Administrator status"><ShieldCheck size={18} /><div><strong>Administrator workspace</strong><span>{adminStatus.data?.email || user?.email} · your established academic plan is retained only in this administrator workspace.</span></div><b>Admin</b></aside> : null}{isAdmin ? <section className="admin-controls" aria-label="Administrator controls"><div><p className="kicker"><ShieldCheck size={13} /> Privacy-preserving overview</p><strong>Administrator controls</strong><span>Workspace-level connection counts only. Private events, tasks, files, and calendars are never exposed here.</span></div><dl><div><dt>MY PLAN accounts</dt><dd>{adminOverview.data?.accountCount ?? "—"}</dd></div><div><dt>Connected accounts</dt><dd>{adminOverview.data?.connectedAccountCount ?? "—"}</dd></div><div><dt>Selected calendars</dt><dd>{adminOverview.data?.selectedCalendarCount ?? "—"}</dd></div></dl><button onClick={() => void adminOverview.refetch()} disabled={adminOverview.isFetching}><RefreshCw size={14} /> {adminOverview.isFetching ? "Refreshing" : "Refresh overview"}</button></section> : null}<div className="account-list">{(persistedConnections.data ?? []).length ? persistedConnections.data?.map(connection => <article className="connection-card" key={connection.id}><div><strong>{connection.email}</strong><span>{connection.accountType} · {connection.calendars.filter(calendar => calendar.isVisible).length} of {connection.calendars.length} calendars selected</span></div><div className="calendar-selection">{connection.calendars.map(calendar => <label key={calendar.id}><input type="checkbox" checked={calendar.isVisible} disabled={!readiness.data?.googleOAuthReady || updateCalendarVisibility.isPending} onChange={event => updateCalendarVisibility.mutate({ linkedCalendarId: calendar.id, isVisible: event.currentTarget.checked })} /><span><b>{calendar.summary}</b><small>{calendar.isPrimary ? "Primary calendar" : calendar.accessRole || "Calendar"}</small></span></label>)}</div></article>) : <article><strong>Google Calendar</strong><span>{readiness.data?.googleOAuthReady ? "Ready to connect after MY PLAN sign-in" : "Activation setup in progress"}</span></article>}</div>{isAuthenticated ? <button className="accent" disabled={!readiness.data?.googleOAuthReady} onClick={() => { window.location.href = "/api/google/connect"; }}>Continue with Google <ExternalLink size={15} /></button> : <button className="account-link" onClick={() => startLogin()}>Sign in before connecting Google <ArrowRight size={15} /></button>}<p className="account-footnote">Google Calendar permission is separate. After connecting, select exactly which of your own calendars MY PLAN can show and synchronize. Other users never see these connections or events.</p></section> : null}
      {section === "admin" && isAdmin ? <section className="workspace-card admin-panel" aria-label="Administrator panel"><header className="admin-panel-heading"><div><p className="kicker"><ShieldCheck size={15} /> Protected administrator panel</p><h1>Plan stewardship, not surveillance.</h1><p>Review account and connection health without opening any person’s private events, tasks, imported files, or calendar contents.</p></div><b>Admin only</b></header><section className="admin-panel-metrics" aria-label="Workspace totals"><article><span>MY PLAN accounts</span><strong>{adminOverview.data?.accountCount ?? "—"}</strong><small>registered planning identities</small></article><article><span>Connected accounts</span><strong>{adminOverview.data?.connectedAccountCount ?? "—"}</strong><small>approved calendar connections</small></article><article><span>Selected calendars</span><strong>{adminOverview.data?.selectedCalendarCount ?? "—"}</strong><small>private calendars opted into sync</small></article></section><section className="admin-command-grid"><article><p className="kicker"><RefreshCw size={14} /> Connection oversight</p><h2>Refresh safe health totals</h2><p>Updates the aggregate counts above. It never displays individual plans, events, or task records.</p><button className="accent" onClick={() => void adminOverview.refetch()} disabled={adminOverview.isFetching}><RefreshCw size={15} /> {adminOverview.isFetching ? "Refreshing overview" : "Refresh overview"}</button></article><article><p className="kicker"><CirclePlus size={14} /> Connection policy</p><h2>Each user selects their own calendars</h2><p>Calendar approval remains private to the connected user. Use Accounts to review your own selections and Sync Center to review delivery readiness.</p><div className="admin-panel-links"><button onClick={() => openSection("accounts")}>Open Accounts <ArrowRight size={14} /></button><button onClick={() => openSection("sync")}>Open Sync Center <ArrowRight size={14} /></button></div></article></section><aside className="admin-guardrail"><ShieldCheck size={18} /><div><strong>Privacy guardrail is active</strong><span>Administrator controls are limited to operational totals. MY PLAN does not offer a screen for reading another person’s schedule, task list, uploads, or private Google Calendar data.</span></div></aside></section> : null}
      {section === "admin" && isAdmin ? <Suspense fallback={<section className="workspace-card"><p>Loading administrator tools…</p></section>}><LazyAdminUserDirectory /></Suspense> : null}
      {section === "sync" ? <section className="workspace-card"><p className="kicker"><CloudCog size={15} /> Sync architecture</p><h1>Connection health</h1><div className="sync-cards"><article><span>Calendar data</span><strong>{readiness.data?.googleOAuthReady ? "Ready to import" : "Demo mode"}</strong></article><article><span>Selected calendars</span><strong>{selectedLinkedCalendarCount || "—"}</strong></article><article><span>Mirrored events</span><strong>{linkedEvents.data?.length ?? 0}</strong></article></div><section className="google-reminder-panel"><div><p className="kicker"><CalendarDays size={14} /> Primary reminders</p><h2>Google Calendar delivers the reminders.</h2><p>After you connect an account and select a calendar, MY PLAN mirrors approved events there. Google Calendar’s own free notifications then alert you even when MY PLAN is closed.</p></div>{isAuthenticated && readiness.data?.googleOAuthReady ? <button className="accent" onClick={() => openSection("accounts")}><CirclePlus size={15} /> Choose calendars</button> : <button onClick={() => openSection("accounts")}><ArrowRight size={15} /> See connection setup</button>}</section><p>MY PLAN does not send surprise notifications. You control which calendars connect, and Google Calendar controls the reminder timing for the items you choose to mirror.</p></section> : null}
      {section === "import" ? <Suspense fallback={<BrandLoader compact label="Preparing Import Schedule…" />}><LazyImportWorkspace isAuthenticated={isAuthenticated} isScanning={extractSchedule.isPending} inputRef={importFileInput} fileName={importFileName} message={importMessage} candidates={importCandidates} onChooseFile={chooseImportFile} onAddApproved={addApprovedImportCandidates} canUndoLastImport={Boolean(lastAutoImportIds || inferredLastImportIds)} onUndoLastImport={undoLastAutomaticImport} onUpdateCandidate={updateImportCandidate} onDiscard={id => setImportCandidates(current => current.filter(item => item.id !== id))} /></Suspense> : null}
      {section === "spark" ? <Suspense fallback={<BrandLoader compact label="Preparing Gemini Spark…" />}><LazySparkWorkspace isAuthenticated={isAuthenticated} accessToken={sparkAccessToken} isPreparing={createSparkAccessToken.isPending} onCopyUrl={() => { navigator.clipboard?.writeText(`${window.location.origin}/api/mcp`); setToast("MCP route copied."); }} onCopyToken={() => { if (sparkAccessToken) navigator.clipboard?.writeText(sparkAccessToken); setToast("Spark credential copied."); }} onGenerateToken={() => createSparkAccessToken.mutate(undefined, { onSuccess: value => setSparkAccessToken(value.token), onError: () => setToast("Could not create a Spark credential. Please try again.") })} /></Suspense> : null}
    </main>
    <button className="notification-trigger" aria-label={`Notifications${unreadNotificationItems.length ? `, ${unreadNotificationItems.length} unread` : ""}`} onClick={() => setShowNotifications(true)}><Bell size={18} />{unreadNotificationItems.length ? <b>{unreadNotificationItems.length > 9 ? "9+" : unreadNotificationItems.length}</b> : null}</button>
    {showNotifications ? <div className="notification-backdrop" onMouseDown={() => setShowNotifications(false)}><section className="notification-center" role="dialog" aria-modal="true" aria-labelledby="notification-center-title" onMouseDown={event => event.stopPropagation()}><header><div><p className="kicker"><Bell size={14} /> Your notification center</p><h2 id="notification-center-title">Only what needs attention.</h2><p>Private to this MY PLAN workspace. Routine notices stay here instead of interrupting your device.</p></div><button aria-label="Close notifications" onClick={() => setShowNotifications(false)}><X size={17} /></button></header><div className="notification-preferences"><label><input type="checkbox" checked={notificationPreferences.taskDue} onChange={event => setNotificationPreferences(current => ({ ...current, taskDue: event.target.checked }))} /> Task deadlines</label><label><input type="checkbox" checked={notificationPreferences.upcomingPlan} onChange={event => setNotificationPreferences(current => ({ ...current, upcomingPlan: event.target.checked }))} /> Starting soon</label></div><div className="notification-actions"><span>{unreadNotificationItems.length ? `${unreadNotificationItems.length} unread` : "All caught up"}</span>{notificationItems.length ? <button onClick={() => setReadNotificationIds(current => Array.from(new Set([...current, ...notificationItems.map(item => item.id)])))}>Mark all read</button> : null}</div>{notificationItems.length ? <div className="notification-list">{notificationItems.map(item => <article key={item.id} className={readNotificationIds.includes(item.id) ? "is-read" : ""}><button onClick={() => { setReadNotificationIds(current => Array.from(new Set([...current, item.id]))); setShowNotifications(false); setSelectedDate(item.createdAt); setCursor(monthStart(item.createdAt)); openSection(item.target); }}><span>{item.kind === "overdue" ? "Overdue" : item.kind === "due-today" ? "Due today" : "Starting soon"}</span><strong>{item.title}</strong><small>{item.body}</small></button></article>)}</div> : <div className="notification-empty"><Bell size={22} /><strong>Nothing needs your attention.</strong><p>When a saved task is due or a plan is about to start, it will appear here.</p></div>}</section></div> : null}
    {dateContextMenu ? <section className="date-context-menu" role="menu" aria-label={`Actions for ${formatShort(dateContextMenu.date)}`} style={{ left: dateContextMenu.x, top: dateContextMenu.y }}><p>{formatShort(dateContextMenu.date)}</p><button role="menuitem" onClick={() => openComposerForDate("task", dateContextMenu.date)}><ListTodo size={15} /><span>Add task</span><small>Capture the next action</small></button><button role="menuitem" onClick={() => openComposerForDate("event", dateContextMenu.date)}><CalendarPlus size={15} /><span>Add event</span><small>Protect time for it</small></button><button role="menuitem" onClick={() => openComposerForDate("block", dateContextMenu.date)}><Clock3 size={15} /><span>Add focus block</span><small>Make space to concentrate</small></button></section> : null}
    {mobileDateAction ? <div className="mobile-date-sheet-backdrop" onPointerDown={() => setMobileDateAction(null)}><section className="mobile-date-sheet" role="dialog" aria-modal="true" aria-label={`Plan ${formatShort(mobileDateAction)}`} onPointerDown={event => event.stopPropagation()}><div className="sheet-handle" /><p className="kicker"><CalendarDays size={14} /> {formatShort(mobileDateAction)}</p><h2>What belongs here?</h2><p>Choose the kind of plan you want to place on this date.</p><button onClick={() => openComposerForDate("task", mobileDateAction)}><ListTodo size={17} /><span><strong>Add task</strong><small>Capture the next action</small></span><ArrowRight size={15} /></button><button onClick={() => openComposerForDate("event", mobileDateAction)}><CalendarPlus size={17} /><span><strong>Add event</strong><small>Protect time for it</small></span><ArrowRight size={15} /></button><button onClick={() => openComposerForDate("block", mobileDateAction)}><Clock3 size={17} /><span><strong>Add focus block</strong><small>Make room to concentrate</small></span><ArrowRight size={15} /></button></section></div> : null}
    {bulkCompleteTaskIds ? <div className="dialog-backdrop recurring-removal-backdrop" onMouseDown={() => setBulkCompleteTaskIds(null)}><section className="recurring-removal-sheet bulk-complete-sheet" role="dialog" aria-modal="true" aria-labelledby="bulk-complete-title" onMouseDown={event => event.stopPropagation()}><p className="kicker"><Check size={14} /> To-do review</p><h2 id="bulk-complete-title">Complete visible tasks?</h2><p>This will mark <strong>{bulkCompleteTaskIds.length} currently visible task{bulkCompleteTaskIds.length === 1 ? "" : "s"}</strong> as done. Tasks outside the current filters will not change.</p><div className="recurring-removal-actions"><button onClick={() => setBulkCompleteTaskIds(null)}>Cancel</button><button className="danger" onClick={confirmBulkComplete}>Mark visible tasks done</button></div></section></div> : null}
    {recurringEditTarget ? <div className="dialog-backdrop recurring-removal-backdrop" onMouseDown={() => setRecurringEditTarget(null)}><section className="recurring-removal-sheet recurring-edit-sheet" role="dialog" aria-modal="true" aria-labelledby="recurring-edit-title" onMouseDown={event => event.stopPropagation()}><p className="kicker"><Edit3 size={14} /> Recurring routine</p><h2 id="recurring-edit-title">What should change?</h2><p><strong>{recurringEditTarget.title}</strong> repeats through its planned range. Choose whether this edit applies to the selected date or every occurrence.</p><div className="recurring-removal-date"><span>Selected date</span><strong>{formatShort(recurringEditTarget.startAt)}</strong></div><div className="recurring-removal-actions"><button onClick={() => setRecurringEditTarget(null)}>Cancel</button><button onClick={() => openBlockEditor(recurringEditTarget, true)}>Edit this date only</button><button onClick={() => { const target = recurringEditTarget; setRecurringEditTarget(null); openBlockEditor(target); }}>Edit entire series</button></div></section></div> : null}
    {recurringRemovalTarget ? <div className="dialog-backdrop recurring-removal-backdrop" onMouseDown={() => setRecurringRemovalTarget(null)}><section className="recurring-removal-sheet" role="dialog" aria-modal="true" aria-labelledby="recurring-removal-title" onMouseDown={event => event.stopPropagation()}><p className="kicker"><Trash2 size={14} /> Recurring routine</p><h2 id="recurring-removal-title">What should be removed?</h2><p><strong>{recurringRemovalTarget.title}</strong> repeats through its planned range. Choose the specific date or the whole series deliberately.</p><div className="recurring-removal-date"><span>Selected date</span><strong>{formatShort(recurringRemovalTarget.startAt)}</strong></div><div className="recurring-removal-actions"><button onClick={() => setRecurringRemovalTarget(null)}>Cancel</button><button onClick={removeSelectedRecurringDate}>Remove this date only</button><button className="danger" onClick={removeRecurringSeries}>Remove entire series</button></div></section></div> : null}
    {conflictNotice ? <aside className="conflict-review" aria-live="polite"><div><p className="kicker"><Flag size={14} /> Schedule overlap</p><strong>{conflictNotice.title} overlaps {conflictNotice.conflicts.length} existing plan{conflictNotice.conflicts.length === 1 ? "" : "s"}.</strong><ul>{conflictNotice.conflicts.map(conflict => <li key={`${conflict.source}-${conflict.title}`}><span>{conflict.title}</span><small>{conflict.source} · {conflict.overlapMinutes} min</small></li>)}</ul></div><div className="conflict-review-actions"><button onClick={() => setConflictNotice(null)}>Keep both</button><button className="accent" onClick={() => { setConflictNotice(null); openSection("calendar"); }}>Review calendar</button></div></aside> : null}
    {activeTask ? <aside className="active-timer" aria-live="polite"><div className="timer-task"><span><Clock3 size={14} /> Focus in progress</span><strong>{activeTask.title}</strong></div><time>{formatElapsed(activeElapsed)}</time><div className="timer-actions">{activeTimer?.startedAt ? <button onClick={pauseTimer}><Pause size={14} /> Pause</button> : <button onClick={resumeTimer}><Play size={14} /> Resume</button>}<button className="timer-finish" onClick={finishTimer}><Check size={14} /> Finish</button></div></aside> : null}
    {showComposer ? <div className="dialog-backdrop" onMouseDown={closeComposer}><section className="composer planner-composer" role="dialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}><div><p className="kicker">{composerKind === "task" ? <ListTodo size={14} /> : composerKind === "event" ? <CalendarPlus size={14} /> : <Clock3 size={14} />} {composerCopy[composerKind].kicker}</p><h2>{editingId ? `Edit ${composerCopy[composerKind].kicker.toLowerCase()}` : composerCopy[composerKind].title}</h2></div><button className="close" onClick={closeComposer} aria-label="Close"><X size={18} /></button><div className="composer-kind-switch" aria-label="Plan item type">{(["task", "event", "block"] as ComposerKind[]).map(kind => <button key={kind} className={composerKind === kind ? "selected" : ""} onClick={() => { resetDraft(kind); }}>{kind === "task" ? "Task" : kind === "event" ? "Event" : "Focus block"}</button>)}</div><label>Title<input autoFocus value={draftTitle} onChange={event => setDraftTitle(event.target.value)} placeholder={composerCopy[composerKind].placeholder} /></label><div className="composer-row"><label>Date<input aria-label="Date YYYY-MM-DD" inputMode="numeric" value={draftDate} onChange={event => setDraftDate(event.target.value)} placeholder="YYYY-MM-DD" /></label><label>Time<input type="time" value={draftTime} onChange={event => setDraftTime(event.target.value)} /></label></div><button className="date-helper" onClick={() => setDraftDate(dateKey(selectedDate))}>Use selected day · {formatShort(selectedDate)}</button><div className="composer-row"><label>Minutes<input aria-label="Duration in minutes" inputMode="numeric" value={draftDuration} onChange={event => setDraftDuration(event.target.value)} /></label><div className="field-label"><span>Priority</span><div className="choice-grid">{(["normal", "high"] as Priority[]).map(priority => <button key={priority} className={draftPriority === priority ? "selected" : ""} onClick={() => setDraftPriority(priority)}>{priority === "high" ? <Flag size={12} /> : null}{priority}</button>)}</div></div></div>{composerKind === "block" ? <div className="field-label"><span>Repeat</span><div className="choice-grid repeat-grid">{(["none", "daily", "weekdays", "weekly", "monthly"] as RepeatRule[]).map(rule => <button key={rule} className={draftRepeat === rule ? "selected" : ""} onClick={() => setDraftRepeat(rule)}>{rule === "none" ? "Once" : rule}</button>)}</div></div> : null}{composerKind !== "block" ? <><label>Course or list<input value={draftCourse} onChange={event => setDraftCourse(event.target.value)} placeholder={composerKind === "task" ? "e.g. Data Structures" : "e.g. Personal"} /></label><label>Notes<textarea value={draftNotes} onChange={event => setDraftNotes(event.target.value)} placeholder="Optional context" /></label></> : null}{composerKind === "task" ? <button className={`schedule-toggle ${draftScheduleTask ? "selected" : ""}`} onClick={() => setDraftScheduleTask(value => !value)}><CalendarDays size={15} /> {draftScheduleTask ? "Scheduled on calendar" : "Keep in task list only"}</button> : null}<button className="accent full" onClick={saveComposer}><Plus size={16} /> {editingId ? "Save changes" : composerCopy[composerKind].submit}</button></section></div> : null}
    {showTour ? <div className="dialog-backdrop tour-backdrop" onMouseDown={() => closeTour()}><section className="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-title" onMouseDown={event => event.stopPropagation()}><button className="close" onClick={() => closeTour()} aria-label="Close tutorial"><X size={18} /></button><p className="kicker"><Sparkles size={14} /> {activeTourSteps[tourStep].eyebrow}</p><div className="tour-count">{tourStep + 1} / {activeTourSteps.length}</div><h2 id="tour-title">{activeTourSteps[tourStep].title}</h2><p>{activeTourSteps[tourStep].body}</p><div className="tour-dots">{activeTourSteps.map((step, index) => <i key={step.title} className={index === tourStep ? "active" : ""} />)}</div><div className="tour-actions"><button onClick={() => closeTour("Tutorial skipped. Return from Welcome any time.")}>Skip</button>{tourStep ? <button onClick={() => moveTour(-1)}>Back</button> : null}<button className="accent" onClick={() => moveTour(1)}>{tourStep === activeTourSteps.length - 1 ? "Finish tour" : "Next"} <ArrowRight size={15} /></button></div></section></div> : null}
  </div>;
}
