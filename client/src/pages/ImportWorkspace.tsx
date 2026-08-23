import { useEffect, useState, type RefObject } from "react";
import { Check, LogIn, ShieldCheck, Trash2, Upload } from "lucide-react";
import { startLogin } from "@/const";

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
  onAddApproved: (weeklyStart?: string, weeklyEnd?: string) => boolean;
  onSetAllApproved?: (approved: boolean) => void;
  canUndoLastImport: boolean;
  onUndoLastImport: () => void;
  onUpdateCandidate: (id: string, patch: Partial<ImportCandidate>) => void;
  onDiscard: (id: string) => void;
};

const weekdayText = (weekdays?: number[]) => (weekdays || []).map(day => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day]).filter(Boolean).join(", ");
const formatTime12Hour = (value: string) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return value || "time not found";
  const hours = Number(match[1]);
  const minutes = match[2];
  if (hours > 23 || Number(minutes) > 59) return value;
  return `${hours % 12 || 12}:${minutes} ${hours >= 12 ? "PM" : "AM"}`;
};
const normalizeTimeInput = (value: string) => {
  const trimmed = value.trim().toUpperCase();
  const twelveHour = /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/.exec(trimmed);
  if (twelveHour) {
    const hour = Number(twelveHour[1]); const minute = Number(twelveHour[2] || "00");
    if (hour < 1 || hour > 12 || minute > 59) return null;
    const canonicalHour = (hour % 12) + (twelveHour[3] === "PM" ? 12 : 0);
    return `${String(canonicalHour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(trimmed) ? trimmed : null;
};

function CandidateDate({ candidate, onUpdateCandidate }: { candidate: ImportCandidate; onUpdateCandidate: ImportWorkspaceProps["onUpdateCandidate"] }) {
  return <label>Date<input aria-label="Imported date" type="date" value={candidate.date} onChange={event => onUpdateCandidate(candidate.id, { date: event.target.value })} /></label>;
}

function CandidateTime({ candidate, isWeekly, onUpdateCandidate }: { candidate: ImportCandidate; isWeekly: boolean; onUpdateCandidate: ImportWorkspaceProps["onUpdateCandidate"] }) {
  const [draft, setDraft] = useState(formatTime12Hour(candidate.time));
  useEffect(() => setDraft(formatTime12Hour(candidate.time)), [candidate.time]);
  const commit = () => {
    const normalized = normalizeTimeInput(draft);
    if (normalized) onUpdateCandidate(candidate.id, { time: normalized }); else setDraft(formatTime12Hour(candidate.time));
  };
  return <label>{isWeekly ? "Grid time" : "Time"}<input aria-label="Imported time" value={draft} placeholder="e.g. 2:00 PM" onChange={event => setDraft(event.target.value)} onBlur={commit} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }} /><small className="import-time-preview">Use 2:00 PM or 14:00</small></label>;
}

function CandidateRow({ candidate, onUpdateCandidate, onDiscard }: Pick<ImportWorkspaceProps, "onUpdateCandidate" | "onDiscard"> & { candidate: ImportCandidate }) {
  const isWeekly = Boolean(candidate.weekdays?.length);
  return <article className={`import-review-row ${candidate.approved ? "is-approved" : ""}`}>
    <label className="import-approve"><input type="checkbox" checked={candidate.approved} onChange={event => onUpdateCandidate(candidate.id, { approved: event.currentTarget.checked })} /><span>Approve</span></label>
    <div className="import-fields">
      <label className="import-subject-field">{isWeekly ? "Subject" : "Title"}<input aria-label="Imported title" value={candidate.title} onChange={event => onUpdateCandidate(candidate.id, isWeekly ? { title: event.target.value, course: event.target.value } : { title: event.target.value })} /></label>
      {isWeekly ? <p className="weekly-timetable-label">Weekly timetable item <b>· {weekdayText(candidate.weekdays)}</b><b>· {formatTime12Hour(candidate.time)}</b></p> : <div className="import-kind-switch">{(["event", "task", "block"] as ComposerKind[]).map(kind => <button key={kind} className={candidate.kind === kind ? "selected" : ""} onClick={() => onUpdateCandidate(candidate.id, { kind })}>{kind === "block" ? "Focus block" : kind}</button>)}</div>}
      <div className="import-detail-fields">
        {!isWeekly ? <CandidateDate candidate={candidate} onUpdateCandidate={onUpdateCandidate} /> : null}
        <CandidateTime candidate={candidate} isWeekly={isWeekly} onUpdateCandidate={onUpdateCandidate} />
        {!isWeekly ? <label>Course/list<input aria-label="Imported course" value={candidate.course} placeholder="Optional" onChange={event => onUpdateCandidate(candidate.id, { course: event.target.value })} /></label> : null}
      </div>
    </div>
    <div className={`confidence-badge ${candidate.confidence < .55 ? "low" : candidate.confidence < .8 ? "medium" : "high"}`}>{Math.round(candidate.confidence * 100)}%<small>confidence</small></div>
    <button className="import-discard" aria-label={`Discard ${candidate.title}`} onClick={() => onDiscard(candidate.id)}><Trash2 size={15} /> Discard</button>
  </article>;
}

export default function ImportWorkspace({ isAuthenticated, isScanning, inputRef, fileName, message, candidates, onChooseFile, onAddApproved, onSetAllApproved, canUndoLastImport, onUndoLastImport, onUpdateCandidate, onDiscard }: ImportWorkspaceProps) {
  const [weeklyStart, setWeeklyStart] = useState("");
  const [weeklyEnd, setWeeklyEnd] = useState("");
  const [submitError, setSubmitError] = useState("");
  const selectedCount = candidates.filter(candidate => candidate.approved).length;
  const selectedWeekly = candidates.filter(candidate => candidate.approved && candidate.weekdays?.length);
  const allApproved = candidates.length > 0 && candidates.every(candidate => candidate.approved);
  const setAllApproved = (approved: boolean) => onSetAllApproved ? onSetAllApproved(approved) : candidates.forEach(candidate => onUpdateCandidate(candidate.id, { approved }));
  const confirm = () => {
    if (selectedWeekly.length && (!weeklyStart || !weeklyEnd)) { setSubmitError("Set both dates in Weekly routine range before adding the selected weekly items."); return; }
    const added = onAddApproved(weeklyStart, weeklyEnd);
    setSubmitError(added ? "" : "Nothing was added. Check the required date fields, then try again.");
  };
  return <section className="workspace-card import-workspace"><p className="kicker"><Upload size={15} /> Schedule importer</p><h1>Bring a schedule into focus.</h1><p>Upload a PDF, image, document, spreadsheet, CSV, or ICS calendar. MY PLAN scans for deadlines, events, routine blocks, and tasks, then lets you check each suggestion before it reaches your private calendar or task list.</p><div className="import-format-list"><span>PDF</span><span>Images</span><span>DOCX</span><span>XLS/XLSX</span><span>CSV</span><span>ICS</span></div>{!isAuthenticated ? <div className="import-ready-card"><ShieldCheck size={22} /><strong>Keep every import private.</strong><p>Sign in first so the uploaded schedule and its suggestions belong only to your MY PLAN workspace.</p><button className="accent" onClick={() => startLogin()}><LogIn size={15} /> Sign in to import</button></div> : <><input ref={inputRef} className="import-file-input" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,.xls,.csv,.ics,application/pdf,image/png,image/jpeg,image/webp,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/calendar" onChange={event => { onChooseFile(event.target.files?.[0]); event.currentTarget.value = ""; }} /><div className={`import-dropzone ${isScanning ? "is-scanning" : ""}`} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); onChooseFile(event.dataTransfer.files?.[0]); }}><Upload size={24} /><strong>{isScanning ? "Scanning your schedule…" : "Drop a schedule here"}</strong><p>{isScanning ? "MY PLAN is creating editable suggestions." : "or choose a file from your device · 10 MB maximum"}</p><button disabled={isScanning} onClick={() => inputRef.current?.click()}>{isScanning ? "Scanning" : "Choose file"}</button></div><p className="import-message" aria-live="polite">{fileName ? <b>{fileName} · </b> : null}{message}</p>{canUndoLastImport ? <aside className="import-undo-card"><div><strong>Recently added a routine?</strong><span>Remove only the most recent imported items. Your earlier calendar entries stay untouched.</span></div><button onClick={onUndoLastImport}>Undo recent import</button></aside> : null}{candidates.length ? <section className="import-review"><div className="import-review-heading"><div><p className="kicker"><Check size={14} /> Review suggestions</p><h2>Choose what enters MY PLAN.</h2></div><div className="import-bulk-actions"><button onClick={() => setAllApproved(!allApproved)}>{allApproved ? "Clear all" : "Select all"}</button><span>{selectedCount} of {candidates.length} approved</span></div></div><p className="import-review-note">Nothing is added until you press <b>Add selected to MY PLAN</b>. One-off items need a real date; weekly routines require one repeat start and end date that you control.</p>{selectedWeekly.length ? <fieldset className="weekly-start-date"><legend>Weekly routine range</legend><label>Starts on<input aria-label="Weekly schedule start date" type="date" value={weeklyStart} onChange={event => { setWeeklyStart(event.currentTarget.value); setSubmitError(""); }} /></label><label>Repeats until<input aria-label="Weekly schedule repeat until date" type="date" min={weeklyStart || undefined} value={weeklyEnd} onChange={event => { setWeeklyEnd(event.currentTarget.value); setSubmitError(""); }} /></label><small>Use this for any routine—school, work, training, or a project. Every selected class repeats only within this range.</small></fieldset> : null}{candidates.map(candidate => <CandidateRow key={candidate.id} candidate={candidate} onUpdateCandidate={onUpdateCandidate} onDiscard={onDiscard} />)}<div className="import-confirm-bar"><span>{selectedCount} selected</span><button className="accent" disabled={!selectedCount} onClick={confirm}><Check size={15} /> Add selected ({selectedCount})</button></div>{submitError ? <p className="import-submit-error" role="alert">{submitError}</p> : null}</section> : null}</>}</section>;
}
