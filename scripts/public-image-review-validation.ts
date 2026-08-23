import { readFile } from "node:fs/promises";
import { invokeLLM, listLLMModels } from "../server/_core/llm";
import { normalizeCandidates } from "../server/scheduleImport";

const image = await readFile("/home/ubuntu/import-validation/montgomery-academic-calendar-2026-27.png");
const { data: models } = await listLLMModels();
const model = models.find(item => item.id === "gpt-5-mini")?.id;
if (!model) throw new Error("The required vision model is unavailable from the live catalog.");
const schema = { type: "object", properties: { candidates: { type: "array", items: { type: "object", properties: { title: { type: "string" }, kind: { type: "string", enum: ["event", "task", "block"] }, date: { type: "string" }, time: { type: "string" }, durationMinutes: { type: "number" }, course: { type: "string" }, notes: { type: "string" }, weekdays: { type: "array", items: { type: "number" } }, confidence: { type: "number" } }, required: ["title", "kind", "date", "time", "durationMinutes", "course", "notes", "weekdays", "confidence"], additionalProperties: false } } }, required: ["candidates"], additionalProperties: false } as const;
const response = await invokeLLM({
  model,
  messages: [
    { role: "system", content: "Extract only explicit dated academic calendar entries visible in this public image. Preserve a full YYYY-MM-DD date when clear. Leave time blank because this image does not state event times. Never infer times, calendar writes, or private data. Return JSON only." },
    { role: "user", content: [{ type: "text", text: "Public 2026-2027 academic calendar image" }, { type: "image_url", image_url: { url: `data:image/png;base64,${image.toString("base64")}`, detail: "high" } }] },
  ],
  response_format: { type: "json_schema", json_schema: { name: "public_image_calendar_review", strict: true, schema } },
});
const candidates = normalizeCandidates(JSON.parse(response.choices[0]?.message?.content || "{\"candidates\":[]}"));
if (!candidates.some(candidate => candidate.date === "2026-08-10") || candidates.some(candidate => candidate.time)) throw new Error("Public image dates or absent times were not preserved safely for review.");
console.log(JSON.stringify({ source: "Montgomery Public Schools 2026-2027 academic calendar image", candidates: candidates.length, datedCandidates: candidates.filter(candidate => candidate.date).length, timedCandidates: candidates.filter(candidate => candidate.time).length, result: "Review-only image candidates retained; no workspace, calendar, task, or storage write was invoked." }, null, 2));
