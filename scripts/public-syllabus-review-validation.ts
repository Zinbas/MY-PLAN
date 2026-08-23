import { readFile } from "node:fs/promises";
import { invokeLLM, listLLMModels } from "../server/_core/llm";
import { normalizeCandidates } from "../server/scheduleImport";

const text = await readFile("/home/ubuntu/import-validation/pearson-course-syllabus.txt", "utf8");
const schedule = text.slice(text.indexOf("Schedule of Classes"), text.indexOf("STUDENT RESPONSIBILITIES"));
if (!schedule.includes("January 27") || !schedule.includes("February 5")) throw new Error("Public syllabus schedule fixture was not extracted as expected.");

const { data: models } = await listLLMModels();
const model = models.find(item => item.id === "gpt-5-mini")?.id;
if (!model) throw new Error("The required text-extraction model is unavailable from the live catalog.");

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
    { role: "system", content: "Extract only explicitly listed academic schedule candidates. A month and day without a year is not a valid calendar date: leave date blank. Do not infer a year, time, weekday, or recurrence. Return JSON only." },
    { role: "user", content: `Public sample syllabus excerpt:\n${schedule}` },
  ],
  response_format: { type: "json_schema", json_schema: { name: "public_syllabus_review", strict: true, schema } },
});
const candidates = normalizeCandidates(JSON.parse(response.choices[0]?.message?.content || "{\"candidates\":[]}"));
if (!candidates.length || candidates.some(candidate => candidate.date || candidate.time)) throw new Error("Ambiguous public syllabus schedule was incorrectly promoted to a calendar-ready date or time.");
console.log(JSON.stringify({ source: "Pearson public course syllabus", candidates: candidates.length, calendarReady: 0, result: "Review-only candidates retained; no storage or calendar write was invoked." }, null, 2));
