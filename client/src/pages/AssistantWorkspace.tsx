import { ArrowRight, CalendarClock, CheckCircle2, MessageCircleMore, Sparkles } from "lucide-react";
import type { AssistantCommandDraft } from "@shared/assistantDraft";
import { assistantDraftCanOpenComposer } from "@shared/assistantDraft";

type Props = {
  value: string;
  draft: AssistantCommandDraft | null;
  isWorking: boolean;
  onChange: (value: string) => void;
  onAsk: () => void;
  onUseExample: (value: string) => void;
  onReview: () => void;
};

const examples = [
  "Create a DSA assignment task for tomorrow and remind me 30 minutes before",
  "Add maths test on Friday at 10 AM, high priority",
  "Block 7 PM tomorrow for 90 minutes to revise chemistry",
];

function labelFor(kind: AssistantCommandDraft["kind"]) {
  return kind === "block" ? "Focus block" : kind === "event" ? "Event" : "Task";
}

export default function AssistantWorkspace({ value, draft, isWorking, onChange, onAsk, onUseExample, onReview }: Props) {
  const canReview = draft ? assistantDraftCanOpenComposer(draft) : false;
  return <section className="workspace-card assistant-workspace" aria-label="MY PLAN Assistant">
    <header className="assistant-heading">
      <div><p className="kicker"><Sparkles size={15} /> MY PLAN Assistant</p><h1>Say what you need.</h1><p>Ask naturally. MY PLAN turns it into a draft for you to review before anything reaches your planner.</p></div>
      <aside><CheckCircle2 size={18} /><span>Nothing saves automatically.</span></aside>
    </header>
    <form className="assistant-form" onSubmit={event => { event.preventDefault(); onAsk(); }}>
      <label htmlFor="assistant-command">What should MY PLAN prepare?</label>
      <textarea id="assistant-command" value={value} onChange={event => onChange(event.target.value)} maxLength={800} placeholder="e.g. Create a Physics test on Friday at 10 AM and remind me 1 hour before" />
      <div className="assistant-form-footer"><span><MessageCircleMore size={14} /> Dates are required. Time and reminders are optional.</span><button className="accent" type="submit" disabled={isWorking || value.trim().length < 3}>{isWorking ? "Preparing draft…" : "Prepare draft"}<ArrowRight size={15} /></button></div>
    </form>
    <div className="assistant-examples" aria-label="Assistant command examples"><span>Try one:</span>{examples.map(example => <button type="button" key={example} onClick={() => onUseExample(example)}>{example}</button>)}</div>
    {draft ? <section className={`assistant-draft ${canReview ? "" : "needs-clarification"}`} aria-live="polite"><div className="assistant-draft-heading"><div><p className="kicker"><CalendarClock size={14} /> {canReview ? "Draft ready to review" : "One detail needed"}</p><h2>{draft.title}</h2></div><b>{labelFor(draft.kind)}</b></div>{canReview ? <dl><div><dt>Date</dt><dd>{draft.date}</dd></div><div><dt>Time</dt><dd>{draft.time || "Not set"}</dd></div><div><dt>Reminder</dt><dd>{draft.reminderLeadMinutes ? `${draft.reminderLeadMinutes >= 60 ? `${draft.reminderLeadMinutes / 60} hour${draft.reminderLeadMinutes === 60 ? "" : "s"}` : `${draft.reminderLeadMinutes} min`} before` : "Not set"}</dd></div>{draft.durationMinutes ? <div><dt>Duration</dt><dd>{draft.durationMinutes} min</dd></div> : null}{draft.course ? <div><dt>Course / list</dt><dd>{draft.course}</dd></div> : null}</dl> : <p className="assistant-clarification">{draft.clarification}</p>}{canReview ? <button className="accent" onClick={onReview}>Review in planner <ArrowRight size={15} /></button> : null}</section> : null}
  </section>;
}
