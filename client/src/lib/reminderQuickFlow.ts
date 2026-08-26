export const QUICK_REMINDER_LEAD_MINUTES = 10;

/**
 * Contextual “Set reminder” actions preselect a calm default lead time.
 * The composer’s native timing menu remains the progressive-disclosure path
 * for 5 minutes, 15 minutes, 30 minutes, 1 hour, and 1 day alternatives.
 */
export function initialReminderLeadForComposer(enableReminder: boolean): number | "" {
  return enableReminder ? QUICK_REMINDER_LEAD_MINUTES : "";
}
