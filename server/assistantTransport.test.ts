import { afterEach, describe, expect, it, vi } from "vitest";
import { invokeLLM } from "./_core/llm";
import { draftAssistantCommand } from "./assistant";

vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn() }));

const mockedInvokeLLM = vi.mocked(invokeLLM);
const input = { message: "plan a biology revision session tomorrow at 09:30", referenceDate: "2026-09-14", timeZone: "Asia/Kolkata" };
const validDraft = {
  kind: "block", title: "Biology revision", date: "2026-09-15", time: "09:30", durationMinutes: 60,
  priority: "normal", course: "Biology", notes: null, reminderLeadMinutes: null, needsClarification: false, clarification: null,
};

describe("MY PLAN Assistant transport and structured-validation boundaries", () => {
  afterEach(() => vi.clearAllMocks());

  it("uses a server-only structured draft request and returns no persistence identifier", async () => {
    mockedInvokeLLM.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(validDraft) } }] } as never);

    const draft = await draftAssistantCommand(input);

    expect(draft).toEqual(validDraft);
    expect(draft).not.toHaveProperty("id");
    expect(mockedInvokeLLM).toHaveBeenCalledTimes(1);
    expect(mockedInvokeLLM).toHaveBeenCalledWith(expect.objectContaining({
      model: "gpt-5-mini", maxCompletionTokens: 700, reasoning: { effort: "minimal" },
      response_format: expect.objectContaining({ type: "json_schema" }),
    }));
  });

  it("rejects malformed, incomplete, invalid-date, invalid-reminder, and untimed lead-time model payloads before review", async () => {
    const invalidPayloads = [
      "not json", JSON.stringify({ kind: "task" }), JSON.stringify({ ...validDraft, date: "2026-02-30" }),
      JSON.stringify({ ...validDraft, reminderLeadMinutes: 7 }), JSON.stringify({ ...validDraft, reminderLeadMinutes: 5, time: null }),
    ];

    for (const content of invalidPayloads) {
      mockedInvokeLLM.mockResolvedValueOnce({ choices: [{ message: { content } }] } as never);
      await expect(draftAssistantCommand(input)).rejects.toThrow();
    }
  });

  it("blocks a broad destructive-command matrix before the LLM transport is called", async () => {
    const messages = ["delete the event", "remove my task", "cancel the block", "edit the meeting", "sync calendar", "import routine", "notify classmates"];

    for (const message of messages) {
      const draft = await draftAssistantCommand({ ...input, message });
      expect(draft.needsClarification, message).toBe(true);
      expect(draft.date, message).toBeNull();
    }

    expect(mockedInvokeLLM).not.toHaveBeenCalled();
  });

  it("rejects oversize input before any model transport is attempted", async () => {
    await expect(draftAssistantCommand({ ...input, message: "a".repeat(801) })).rejects.toThrow();
    expect(mockedInvokeLLM).not.toHaveBeenCalled();
  });
});
