import { CalendarCheck2, CalendarDays, Check, LockKeyhole, RefreshCw } from "lucide-react";
import { calendarSelectionSummary } from "@/lib/calendarSelectionUx";

type Calendar = { id: number; summary: string; isPrimary: boolean; isVisible: boolean; accessRole?: string | null };
type Connection = { id: number; email: string; accountType: string; calendars: Calendar[] };

export default function CalendarConnectionPicker({ connections, isSaving, onToggle }: {
  connections: Connection[];
  isSaving: boolean;
  onToggle: (linkedCalendarId: number, isVisible: boolean) => void;
}) {
  return <section className="calendar-connection-list" aria-label="Connected Google calendars">
    {connections.map(connection => {
      const selectedCount = connection.calendars.filter(calendar => calendar.isVisible).length;
      return <article className="calendar-connection-card" key={connection.id}>
        <header className="calendar-connection-header"><div className="connection-identity"><span className="connection-mark"><CalendarDays size={18} /></span><div><p className="kicker">Connected Google account</p><h2>{connection.email}</h2><p>{connection.accountType} · {calendarSelectionSummary(selectedCount, connection.calendars.length)}</p></div></div><span className={`calendar-selection-count ${selectedCount ? "is-active" : ""}`}>{selectedCount}/{connection.calendars.length}</span></header>
        <div className="calendar-picker-intro"><div><strong>Choose what appears in MY PLAN</strong><span>Select only calendars you want MY PLAN to display and synchronize. You can change this at any time.</span></div>{isSaving ? <span className="calendar-saving"><RefreshCw size={13} /> Saving</span> : null}</div>
        <div className="calendar-choice-grid" role="group" aria-label={`Calendars for ${connection.email}`}>
          {connection.calendars.map(calendar => <button type="button" key={calendar.id} className={`calendar-choice ${calendar.isVisible ? "is-selected" : ""}`} aria-pressed={calendar.isVisible} disabled={isSaving} onClick={() => onToggle(calendar.id, !calendar.isVisible)}>
            <span className="calendar-choice-check" aria-hidden="true">{calendar.isVisible ? <Check size={15} /> : null}</span>
            <span className="calendar-choice-copy"><b>{calendar.summary}</b><small>{calendar.isPrimary ? "Primary calendar" : calendar.accessRole || "Google calendar"}</small></span>
            {calendar.isPrimary ? <span className="calendar-primary-label">Primary</span> : null}
          </button>)}
        </div>
        <footer className="calendar-picker-privacy"><LockKeyhole size={14} /><span>Your choices are private to this MY PLAN account. Selecting a calendar does not share it with anyone else.</span></footer>
      </article>;
    })}
  </section>;
}
