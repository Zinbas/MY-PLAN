import { invokeLLM } from "./_core/llm";
import { assistantCommandDraftSchema, assistantDraftInputSchema, type AssistantCommandDraft, type AssistantDraftInput } from "@shared/assistantDraft";

const assistantResponseSchema = {
  type: "json_schema" as const,
  json_schema: {
    name: "my_plan_assistant_draft",
    strict: true,
    schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["task", "event", "block"] },
        title: { type: "string" },
        date: { type: ["string", "null"] },
        time: { type: ["string", "null"] },
        durationMinutes: { type: ["integer", "null"] },
        priority: { type: "string", enum: ["normal", "high"] },
        course: { type: ["string", "null"] },
        notes: { type: ["string", "null"] },
        reminderLeadMinutes: { type: ["integer", "null"] },
        needsClarification: { type: "boolean" },
        clarification: { type: ["string", "null"] },
      },
      required: ["kind", "title", "date", "time", "durationMinutes", "priority", "course", "notes", "reminderLeadMinutes", "needsClarification", "clarification"],
      additionalProperties: false,
    },
  },
};

function assistantSystemPrompt({ referenceDate, timeZone }: AssistantDraftInput) {
  return `You are MY PLAN Assistant. Convert one planning request into a draft only. Never claim an action was saved, sent, scheduled, synced, deleted, or completed. Return JSON only.

Today is ${referenceDate} in ${timeZone}. Resolve clear relative dates such as today, tomorrow, next Monday, and this Friday using that reference. Handle common small typos and planning slang, including evt/event, tmw/tmr/tomorrow, hw/homework, assgn/assignment, rev/revision, and rem/remind.

Select kind: task for a next action or deadline, event for a personal appointment, block for focused study/work time. Date is required to review a draft. Time is optional. Reminder is optional and must use only 5, 10, 15, 30, 60, or 1440 minutes before. Default duration is 60 minutes only for events and blocks when a time is supplied; otherwise use null. Set high priority only if the user explicitly signals urgency.

Never invent a date, time, reminder, course, notes, or private data. If the requested date is absent or unclear, set date to null, needsClarification to true, and state the one short question needed. Do not ask for clarification when a date is clear. Use date YYYY-MM-DD and time HH:MM in 24-hour format.`;
}

export async function draftAssistantCommand(rawInput: AssistantDraftInput): Promise<AssistantCommandDraft> {
  const input = assistantDraftInputSchema.parse(rawInput);
  const response = await invokeLLM({
    model: "gpt-5-mini",
    maxCompletionTokens: 700,
    reasoning: { effort: "minimal" },
    messages: [
      { role: "system", content: assistantSystemPrompt(input) },
      { role: "user", content: input.message },
    ],
    response_format: assistantResponseSchema,
  });
  const content = response.choices[0]?.message.content;
  if (typeof content !== "string" || !content) throw new Error("MY PLAN Assistant returned no draft.");
  return assistantCommandDraftSchema.parse(JSON.parse(content));
}
