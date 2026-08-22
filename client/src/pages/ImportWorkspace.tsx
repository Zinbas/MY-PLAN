import { useState, type RefObject } from "react";
import { CalendarDays, Check, LogIn, ShieldCheck, Trash2, Upload } from "lucide-react";
import { startLogin } from "@/const";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { dateForImportInput, dateFromImportInput } from "@/lib/importDates";

type ComposerKind = "block" | "event" | "task";
export type ImportCandidate = { id: string; title: string; kind: ComposerKind; date: string; time: string; durationMinutes: number; course: string; notes: string; weekdays?: number[]; confidence: number; approved: boolean };

type ImportWorkspaceProps = {
  isAuthenticated: boolean;
  isScanning: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  fileName: string;
  message: string;
  candidates: ImportCandidate[];
  onChooseFile: (file?: File) => void;
  onAddApproved: (weeklyStart?: string) => void;
  onUpdateCandidate: (id: string, patch: Partial<ImportCandidate>) => void;
  onDiscard: (id: string) => void;
};

const weekdayText = (weekdays?: number[]) => (weekdays || []).map(day => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day]).filter(Boolean).join(", ");

function CandidateDate({ candidate, onUpdateCandidate }: { candidate: ImportCandidate; onUpdateCandidate: ImportWorkspaceProps["onUpdateCandidate"] }) {
  return <label>{candidate.weekdays?.length ? "Specific date (optional)" : "Date"}<div className="import-date-picker"><input aria-label="Imported date" value={candidate.date} placeholder="YYYY-MM-DD" onChange={event => onUpdateCandidate(candidate.id, { date: event.target.value })} /><Popover><PopoverTrigger asChild><button type="button" aria-label={`Choose date for ${candidate.title}`}><CalendarDays size={15} /></button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={dateFromImportInput(candidate.date)} onSelect={date => { if (date) onUpdateCandidate(candidate.id, { date: dateForImportInput(date) }); }} initialFocus /></PopoverContent></Popover></div></label>;
}

function CandidateRow({ candidate, onUpdateCandidate, onDiscard }: Pick<ImportWorkspaceProps, "onUpdateCandidate" | "onDiscard"> & { candidate: ImportCandidate }) {
  const isWeekly = Boolean(candidate.weekdays?.length);
  return <article className={`import-review-row ${candidate.approved ? "is-approved" : ""}`} key={candidate.id}>
    <label className="import-approve"><input type="checkbox" checked={candidate.approved} onChange={event => onUpdateCandidate(candidate.id, { approved: event.currentTarget.checked })} /><span>Approve</span></label>
    <div className="import-fields">
      <label className="import-subject-field">{isWeekly ? "Subject" : "Title"}<input aria-label="Imported title" value={candidate.title} onChange={event => onUpdateCandidate(candidate.id, isWeekly ? { title: event.target.value, course: event.target.value } : { title: event.target.value })} /></label>
      {isWeekly ? <p className="weekly-timetable-label">Weekly timetable item <b>· {weekdayText(candidate.weekdays)}</b><b>· {candidate.time || "time not found"}</b></p> : <div className="import-kind-switch">{(["event", "task", "block"] as ComposerKind[]).map(kind => <button key={kind} className={candidate.kind === kind ? "selected" : ""} onClick={() => onUpdateCandidate(candidate.id, { kind })}>{kind === "block" ? "Focus block" : kind}</button>)}</div>}
      <div className="import-detail-fields">
        <CandidateDate candidate={candidate} onUpdateCandidate={onUpdateCandidate} />
        <label>{isWeekly ? "Grid time" : "Time"}<input aria-label="Imported time" value={candidate.time} placeholder="HH:MM" onChange={event => onUpdateCandidate(candidate.id, { time: event.target.value })} /></label>
        {!isWeekly ? <label>Course/list<input aria-label="Imported course" value={candidate.course} placeholder="Optional" onChange={event => onUpdateCandidate(candidate.id, { course: event.target.value })} /></label> : null}
      </div>
    </div>
    <div className={`confidence-badge ${candidate.confidence < .55 ? "low" : candidate.confidence < .8 ? "medium" : "high"}`}>{Math.round(candidate.confidence * 100)}%<small>confidence</small></div>
    <button className="import-discard" aria-label={`Discard ${candidate.title}`} onClick={() => onDiscard(candidate.id)}><Trash2 size={15} /> Discard</button>
  </article>;
}

export default function ImportWorkspace({ isAuthenticated, isScanning, inputRef, fileName, message, candidates, onChooseFile, onAddApproved, onUpdateCandidate, onDiscard }: ImportWorkspaceProps) {
  const [weeklyStart, setWeeklyStart] = useState("");
  const selectedCount = candidates.filter(candidate => candidate.approved).length;
  const selectedWeekly = candidates.filter(candidate => candidate.approved && candidate.weekdays?.length && !candidate.date);
  const confirm = () => onAddApproved(weeklyStart);
  return <section className="workspace-card import-workspace"><p className="kicker"><Upload size={15} /> Schedule importer</p><h1>Bring a schedule into focus.</h1><p>Upload a PDF, image, document, spreadsheet, CSV, or ICS calendar. MY PLAN scans for deadlines, events, routine blocks, and tasks, then lets you check each suggestion before it reaches your private calendar or task list.</p><div className="import-format-list"><span>PDF</span><span>Images</span><span>DOCX</span><span>XLS/XLSX</span><span>CSV</span><span>ICS</span></div>{!isAuthenticated ? <div className="import-ready-card"><ShieldCheck size={22} /><strong>Keep every import private.</strong><p>Sign in first so the uploaded schedule and its suggestions belong only to your MY PLAN workspace.</p><button className="accent" onClick={() => startLogin()}><LogIn size={15} /> Sign in to import</button></div> : <><input ref={inputRef} className="import-file-input" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,.xls,.csv,.ics,application/pdf,image/png,image/jpeg,image/webp,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/calendar" onChange={event => { onChooseFile(event.target.files?.[0]); event.currentTarget.value = ""; }} /><div className={`import-dropzone ${isScanning ? "is-scanning" : ""}`} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); onChooseFile(event.dataTransfer.files?.[0]); }}><Upload size={24} /><strong>{isScanning ? "Scanning your schedule…" : "Drop a schedule here"}</strong><p>{isScanning ? "MY PLAN is creating editable suggestions." : "or choose a file from your device · 10 MB maximum"}</p><button disabled={isScanning} onClick={() => inputRef.current?.click()}>{isScanning ? "Scanning" : "Choose file"}</button></div><p className="import-message" aria-live="polite">{fileName ? <b>{fileName} · </b> : null}{message}</p>{candidates.length ? <section className="import-review"><div className="import-review-heading"><div><p className="kicker"><Check size={14} /> Review suggestions</p><h2>Choose what enters MY PLAN.</h2></div><button className="accent" disabled={!selectedCount} onClick={confirm}><Check size={15} /> Add selected to MY PLAN ({selectedCount})</button></div><p className="import-review-note">Nothing is added until you press <b>Add selected to MY PLAN</b>. One-off items need a real date; selected weekly timetable items need one schedule start date.</p>{selectedWeekly.length ? <label className="weekly-start-date">Start selected weekly timetable on<input aria-label="Weekly schedule start date" type="date" value={weeklyStart} onChange={event => setWeeklyStart(event.currentTarget.value)} /><small>MY PLAN preserves each visible weekday and grid time as a weekly focus block.</small></label> : null}{candidates.map(candidate => <CandidateRow key={candidate.id} candidate={candidate} onUpdateCandidate={onUpdateCandidate} onDiscard={onDiscard} />)}<div className="import-confirm-bar"><div><strong>{selectedCount ? `${selectedCount} item${selectedCount === 1 ? "" : "s"} selected` : "Nothing selected"}</strong><small>Review remains editable. No calendar change happens before this action.</small></div><button className="accent" disabled={!selectedCount} onClick={confirm}><Check size={15} /> Add selected to MY PLAN ({selectedCount})</button></div></section> : null}</>}</section>;
}
