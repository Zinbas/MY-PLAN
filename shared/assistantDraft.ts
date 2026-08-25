import { z } from "zod";

export const assistantKinds = ["task", "event", "block"] as const;
export const assistantReminderLeads = [5, 10, 15, 30, 60, 1440] as const;

export function isAssistantDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export const assistantCommandDraftSchema = z.object({
  kind: z.enum(assistantKinds),
  title: z.string().trim().min(1).max(160),
  date: z.string().refine(isAssistantDate, "Use a real YYYY-MM-DD date.").nullable(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a valid 24-hour time.").nullable(),
  durationMinutes: z.number().int().min(15).max(720).nullable(),
  priority: z.enum(["normal", "high"]),
  course: z.string().trim().max(120).nullable(),
  notes: z.string().trim().max(500).nullable(),
  reminderLeadMinutes: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(30), z.literal(60), z.literal(1440)]).nullable(),
  needsClarification: z.boolean(),
  clarification: z.string().trim().max(240).nullable(),
}).superRefine((draft, context) => {
  if (!draft.needsClarification && !draft.date) context.addIssue({ code: z.ZodIssueCode.custom, path: ["date"], message: "A date is required before this draft can be reviewed." });
  if (draft.needsClarification && !draft.clarification) context.addIssue({ code: z.ZodIssueCode.custom, path: ["clarification"], message: "Explain what needs clarification." });
});

export type AssistantCommandDraft = z.infer<typeof assistantCommandDraftSchema>;

export const assistantDraftInputSchema = z.object({
  message: z.string().trim().min(3).max(800),
  referenceDate: z.string().refine(isAssistantDate, "Reference date must be a real YYYY-MM-DD value."),
  timeZone: z.string().trim().min(1).max(120),
});

export type AssistantDraftInput = z.infer<typeof assistantDraftInputSchema>;

export function assistantDraftCanOpenComposer(draft: AssistantCommandDraft) {
  return !draft.needsClarification && Boolean(draft.date);
}
