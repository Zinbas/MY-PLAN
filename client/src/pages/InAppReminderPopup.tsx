import { BellRing, Clock3, X } from "lucide-react";
import type { InAppReminderCandidate } from "@/lib/inAppReminders";

type Props = { reminder: InAppReminderCandidate; onDismiss: () => void; onSnooze: () => void };

export default function InAppReminderPopup({ reminder, onDismiss, onSnooze }: Props) {
  const label = reminder.source === "task" ? "Task" : reminder.source === "event" ? "Event" : "Focus block";
  const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(reminder.startAt);
  return <aside className="due-reminder-popup" role="alertdialog" aria-live="assertive" aria-label={`Reminder for ${reminder.title}`}><div className="due-reminder-icon"><BellRing size={20} /></div><div className="due-reminder-copy"><p><Clock3 size={13} /> {label} · starts at {time}</p><strong>{reminder.title}</strong><span>{reminder.leadMinutes === 60 ? "Starts in 1 hour" : reminder.leadMinutes >= 1440 ? "Starts tomorrow" : `Starts in ${reminder.leadMinutes} minutes`}</span></div><button className="due-reminder-close" onClick={onDismiss} aria-label="Dismiss reminder" title="Dismiss"><X size={17} /></button><div className="due-reminder-actions"><button onClick={onDismiss}>Dismiss</button><button className="accent" onClick={onSnooze}>Snooze 5 min</button></div></aside>;
}
