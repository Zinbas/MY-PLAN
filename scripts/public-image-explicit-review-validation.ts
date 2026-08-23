import { readFile } from "node:fs/promises";
import { invokeLLM, listLLMModels } from "../server/_core/llm";
import { normalizeCandidates } from "../server/scheduleImport";

const image = await readFile("/home/ubuntu/import-validation/gate-2026-examination-schedule.jpeg");
const { data: models } = await listLLMModels();
const model = models.find(item => item.id === "gpt-5-mini")?.id;
if (!model) throw new Error("The required vision model is unavailable from the live catalog.");

const schema = {
  type: "object",
  properties: {
    candidates: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" }, kind: { type: "string", enum: ["event", "task", "block"] }, date: { type: "string" }, time: { type: "string" }, durationMinutes: { type: "number" }, course: { type: "string" }, notes: { type: "string" }, weekdays: { type: "array", items: { type: "number" } }, confidence: { type: "number" },
        },
        required: ["title", "kind", "date", "time", "durationMinutes", "course", "notes", "weekdays", "confidence"],
        additionalProperties: false,
      },
    },
  },
  required: ["candidates"],
  additionalProperties: false,
} as const;

const response = await invokeLLM({
  model,
  messages: [
    { role: "system", content: "Extract every visible GATE 2026 examination-session row from this public timetable image. Each row has a full date and an explicit start/end time. Create one event candidate per visible session. Convert dates to YYYY-MM-DD, start time to 24-hour HH:MM, and set durationMinutes to 180. Preserve the displayed test-paper codes in the title or notes. Do not infer rows not visible, do not write any calendar/task/workspace/storage data, and return JSON only." },
    { role: "user", content: [{ type: "text", text: "Public GATE 2026 examination schedule image" }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${image.toString("base64")}`, detail: "high" } }] },
  ],
  response_format: { type: "json_schema", json_schema: { name: "public_image_explicit_schedule_review", strict: true, schema } },
});

const candidates = normalizeCandidates(JSON.parse(response.choices[0]?.message?.content || "{\"candidates\":[]}"));
const hasSession = (date: string, time: string) => candidates.some(candidate => candidate.date === date && candidate.time === time && candidate.durationMinutes === 180);
if (candidates.length < 8 || !hasSession("2026-02-07", "09:30") || !hasSession("2026-02-07", "14:30") || !hasSession("2026-02-14", "14:30")) {
  throw new Error(`Explicit public image date/time extraction did not retain the expected session rows: ${JSON.stringify(candidates)}`);
}

console.log(JSON.stringify({
  source: "GATE 2026 Examination Schedule image cross-checked against IIT Guwahati's official schedule page",
  candidates: candidates.length,
  datedCandidates: candidates.filter(candidate => candidate.date).length,
  timedCandidates: candidates.filter(candidate => candidate.time).length,
  requiredSessions: ["2026-02-07 09:30", "2026-02-07 14:30", "2026-02-14 14:30"],
  result: "Explicit public image dates and times were retained as review candidates; no workspace, calendar, task, or storage write was invoked.",
}, null, 2));
