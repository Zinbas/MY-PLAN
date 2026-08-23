import { readFile } from "node:fs/promises";
import { invokeLLM, listLLMModels } from "../server/_core/llm";
import { normalizeCandidates } from "../server/scheduleImport";

const text = await readFile("/home/ubuntu/import-validation/tamut-engl1301-syllabus.txt", "utf8");
const schedule = text.slice(text.indexOf("Week 1: March 6-13, 2026"), text.indexOf("Week 8:"));
if (!schedule.includes("March 14, 2026") || !schedule.includes("11:59 PM")) throw new Error("Explicit public syllabus fixture was not extracted as expected.");
const { data: models } = await listLLMModels();
const model = models.find(item => item.id === "gpt-5-mini")?.id;
if (!model) throw new Error("The required text-extraction model is unavailable from the live catalog.");
const schema = { type: "object", properties: { candidates: { type: "array", items: { type: "object", properties: { title: { type: "string" }, kind: { type: "string", enum: ["event", "task", "block"] }, date: { type: "string" }, time: { type: "string" }, durationMinutes: { type: "number" }, course: { type: "string" }, notes: { type: "string" }, weekdays: { type: "array", items: { type: "number" } }, confidence: { type: "number" } }, required: ["title", "kind", "date", "time", "durationMinutes", "course", "notes", "weekdays", "confidence"], additionalProperties: false } } }, required: ["candidates"], additionalProperties: false } as const;
const response = await invokeLLM({
  model,
  messages: [
    { role: "system", content: "Extract only explicit module deadlines from this public academic schedule. Preserve a full YYYY-MM-DD date and 24-hour HH:MM time when both are stated. Return task candidates only. Do not invent dates, times, or calendar writes. Return JSON only." },
    { role: "user", content: `Public syllabus schedule excerpt:\n${schedule}` },
  ],
  response_format: { type: "json_schema", json_schema: { name: "public_explicit_syllabus_review", strict: true, schema } },
});
const candidates = normalizeCandidates(JSON.parse(response.choices[0]?.message?.content || "{\"candidates\":[]}"));
const explicit = candidates.filter(candidate => candidate.date && candidate.time);
if (!explicit.some(candidate => candidate.date === "2026-03-14" && candidate.time === "23:59")) throw new Error("Explicit public syllabus deadline was not retained as an editable date/time candidate.");
console.log(JSON.stringify({ source: "Texas A&M University–Texarkana public syllabus", candidates: candidates.length, explicitDateTimeCandidates: explicit.length, example: explicit.find(candidate => candidate.date === "2026-03-14" && candidate.time === "23:59"), result: "Review candidates only; no workspace, calendar, task, or storage write was invoked." }, null, 2));
