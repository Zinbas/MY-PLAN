import { randomUUID } from "crypto";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";

export type ScheduleCandidate = {
  id: string;
  title: string;
  kind: "event" | "task" | "block";
  date: string;
  time: string;
  durationMinutes: number;
  course: string;
  notes: string;
  weekdays: number[];
  confidence: number;
};

type UploadedSchedule = {
  fileName: string;
  mimeType: string;
  contentBase64: string;
};

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const candidateKinds = new Set(["event", "task", "block"]);

function decodeBase64(value: string) {
  const normalized = value.includes(",") ? value.slice(value.indexOf(",") + 1) : value;
  const buffer = Buffer.from(normalized, "base64");
  if (!buffer.length || buffer.length > MAX_FILE_BYTES) throw new Error("Upload must be between 1 byte and 10 MB.");
  return buffer;
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : value == null ? "" : String(value).replace(/\s+/g, " ").trim();
}

function dateOnly(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${String(value.getFullYear()).padStart(4, "0")}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  if (typeof value === "number" && value > 1 && value < 100_000) {
    const parsedExcelDate = XLSX.SSF.parse_date_code(value);
    if (parsedExcelDate) return `${String(parsedExcelDate.y).padStart(4, "0")}-${String(parsedExcelDate.m).padStart(2, "0")}-${String(parsedExcelDate.d).padStart(2, "0")}`;
  }
  const text = cleanText(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{5}(?:\.\d+)?$/.test(text)) {
    const parsedExcelDate = XLSX.SSF.parse_date_code(Number(text));
    if (parsedExcelDate) return `${String(parsedExcelDate.y).padStart(4, "0")}-${String(parsedExcelDate.m).padStart(2, "0")}-${String(parsedExcelDate.d).padStart(2, "0")}`;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

function timeOnly(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  }
  if (typeof value === "number" && value >= 0 && value < 1) {
    const minutes = Math.round(value * 24 * 60) % (24 * 60);
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  }
  const text = cleanText(value);
  const match = text.match(/(?:^|\s)(\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]))?(?:\s|$)/);
  if (!match) return "";
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (match[3]) {
    if (match[3].toLowerCase() === "pm" && hour < 12) hour += 12;
    if (match[3].toLowerCase() === "am" && hour === 12) hour = 0;
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function csvRows(text: string) {
  const workbook = XLSX.read(text, { type: "string", raw: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return sheet ? XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" }) : [];
}

function readColumn(row: Record<string, unknown>, expressions: RegExp[]) {
  const entry = Object.entries(row).find(([key]) => expressions.some(expression => expression.test(key.toLowerCase())));
  return entry ? entry[1] : "";
}

export function rowCandidates(rows: Record<string, unknown>[]): ScheduleCandidate[] {
  return rows.slice(0, 120).flatMap((row, index) => {
    const title = cleanText(readColumn(row, [/title/, /event/, /task/, /subject/, /course/, /activity/, /description/])) || cleanText(Object.values(row).find(value => cleanText(value)));
    const date = dateOnly(readColumn(row, [/date/, /day/, /due/, /start/])) || dateOnly(readColumn(row, [/deadline/])) ;
    if (!title) return [];
    const typeValue = cleanText(readColumn(row, [/type/, /kind/])).toLowerCase();
    const kind: ScheduleCandidate["kind"] = typeValue.includes("task") || typeValue.includes("deadline") ? "task" : typeValue.includes("block") || typeValue.includes("study") ? "block" : "event";
    const durationNumber = Number(cleanText(readColumn(row, [/duration/, /minutes/, /mins/]))) || 60;
    return [{
      id: `local-${index}-${randomUUID()}`,
      title,
      kind,
      date,
      time: timeOnly(readColumn(row, [/time/, /start/])),
      durationMinutes: Math.max(15, Math.min(720, Math.round(durationNumber))),
      course: cleanText(readColumn(row, [/course/, /subject/, /class/, /list/])),
      notes: cleanText(readColumn(row, [/note/, /detail/, /description/])),
      weekdays: [],
      confidence: date ? 0.94 : 0.62,
    }];
  });
}

function unfoldedLines(text: string) {
  return text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
}

function icsDate(value: string) {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);
  if (!match) return { date: "", time: "" };
  return { date: `${match[1]}-${match[2]}-${match[3]}`, time: match[4] ? `${match[4]}:${match[5]}` : "" };
}

export function icsCandidates(text: string): ScheduleCandidate[] {
  const output: ScheduleCandidate[] = [];
  let event: Record<string, string> | null = null;
  for (const line of unfoldedLines(text)) {
    if (line === "BEGIN:VEVENT") { event = {}; continue; }
    if (line === "END:VEVENT" && event) {
      const start = icsDate(event.DTSTART || "");
      const end = icsDate(event.DTEND || "");
      const startMinutes = start.time ? Number(start.time.slice(0, 2)) * 60 + Number(start.time.slice(3)) : 0;
      const endMinutes = end.time ? Number(end.time.slice(0, 2)) * 60 + Number(end.time.slice(3)) : 60;
      output.push({
        id: `ics-${randomUUID()}`,
        title: event.SUMMARY || "Untitled calendar event",
        kind: "event",
        date: start.date,
        time: start.time,
        durationMinutes: Math.max(15, end.date === start.date ? endMinutes - startMinutes : 60),
        course: "",
        notes: event.DESCRIPTION || "",
        weekdays: [],
        confidence: start.date ? 0.99 : 0.65,
      });
      event = null;
      continue;
    }
    if (!event) continue;
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const key = line.slice(0, separator).split(";")[0];
    event[key] = line.slice(separator + 1).replace(/\\n/g, "\n").trim();
  }
  return output;
}

export async function workbookCandidates(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const rows = workbook.SheetNames.slice(0, 5).flatMap(name => XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[name], { defval: "" }));
  return rowCandidates(rows);
}

const extractionSchema = {
  type: "object",
  properties: {
    candidates: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          kind: { type: "string", enum: ["event", "task", "block"] },
          date: { type: "string" },
          time: { type: "string" },
          durationMinutes: { type: "number" },
          course: { type: "string" },
          notes: { type: "string" },
          weekdays: { type: "array", items: { type: "number", minimum: 0, maximum: 6 } },
          confidence: { type: "number" },
        },
        required: ["title", "kind", "date", "time", "durationMinutes", "course", "notes", "weekdays", "confidence"],
        additionalProperties: false,
      },
    },
  },
  required: ["candidates"],
  additionalProperties: false,
} as const;

export function normalizeCandidates(value: unknown): ScheduleCandidate[] {
  const candidates = Array.isArray((value as { candidates?: unknown[] })?.candidates) ? (value as { candidates: unknown[] }).candidates : [];
  const normalized = candidates.slice(0, 120).flatMap((candidate, index) => {
    if (!candidate || typeof candidate !== "object") return [];
    const record = candidate as Record<string, unknown>;
    const title = cleanText(record.title);
    if (!title) return [];
    const kind = candidateKinds.has(cleanText(record.kind)) ? cleanText(record.kind) as ScheduleCandidate["kind"] : "event";
    return [{
      id: `ai-${index}-${randomUUID()}`,
      title,
      kind,
      date: dateOnly(record.date),
      time: timeOnly(record.time),
      durationMinutes: Math.max(15, Math.min(720, Math.round(Number(record.durationMinutes) || 60))),
      course: cleanText(record.course),
      notes: cleanText(record.notes),
      weekdays: Array.isArray(record.weekdays) ? record.weekdays.filter(day => typeof day === "number" && Number.isInteger(day) && day >= 0 && day <= 6) : [],
      confidence: Math.max(0, Math.min(1, Number(record.confidence) || 0.5)),
    }];
  });
  return deduplicateTimetableCandidates(normalized);
}

export function deduplicateTimetableCandidates(candidates: ScheduleCandidate[]) {
  const perDayCandidates = candidates.flatMap(candidate => {
    const weekdays = Array.from(new Set(candidate.weekdays.filter(day => Number.isInteger(day) && day >= 0 && day <= 6)));
    if (weekdays.length < 2) return [{ ...candidate, weekdays }];
    return weekdays.map(day => ({ ...candidate, id: `${candidate.id}-weekday-${day}`, weekdays: [day] }));
  });
  const seen = new Map<string, ScheduleCandidate>();
  for (const candidate of perDayCandidates) {
    const weekday = candidate.weekdays.length === 1 ? candidate.weekdays[0] : null;
    const slot = weekday == null || !candidate.time ? "" : `${weekday}|${candidate.time}`;
    const key = slot || `unique|${candidate.id}`;
    const current = seen.get(key);
    if (!current) { seen.set(key, candidate); continue; }
    const score = (value: ScheduleCandidate) =>
      (value.course && value.title.localeCompare(value.course, undefined, { sensitivity: "accent" }) === 0 ? 3 : 0)
      + (value.notes ? 1 : 0)
      + value.confidence;
    if (score(candidate) > score(current)) seen.set(key, candidate);
  }
  return Array.from(seen.values()).map(candidate => candidate.weekdays.length
    ? { ...candidate, course: candidate.title }
    : candidate);
}

function parseModelCandidates(value: unknown) {
  const text = typeof value === "string" ? value.trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "") : "{\"candidates\":[]}";
  try {
    return JSON.parse(text);
  } catch {
    const recovered = Array.from(text.matchAll(/\{(?:[^{}"]|"(?:\\.|[^"\\])*")+\}/g))
      .flatMap(match => {
        try {
          const parsed = JSON.parse(match[0]) as Record<string, unknown>;
          return typeof parsed.title === "string" ? [parsed] : [];
        } catch {
          return [];
        }
      });
    if (recovered.length) return { candidates: recovered };
    throw new Error("The schedule scan returned an incomplete response. Please try the image again or upload a clearer copy.");
  }
}

async function modelCandidates(fileName: string, mimeType: string, buffer: Buffer, extractedText?: string) {
  const content = extractedText
    ? [{ type: "text" as const, text: `File name: ${fileName}\n\nExtracted content:\n${extractedText.slice(0, 60_000)}` }]
    : mimeType.startsWith("image/")
      ? [{ type: "text" as const, text: `Extract schedule candidates from this ${fileName}.` }, { type: "image_url" as const, image_url: { url: `data:${mimeType};base64,${buffer.toString("base64")}`, detail: "high" as const } }]
      : [{ type: "text" as const, text: `Extract schedule candidates from this ${fileName}.` }, { type: "file_url" as const, file_url: { url: `data:${mimeType};base64,${buffer.toString("base64")}`, mime_type: "application/pdf" as const } }];
  const response = await invokeLLM({
    model: "gemini-3.1-pro-preview",
    max_tokens: 14000,
    messages: [
      { role: "system", content: "You extract schedules cautiously. Return only events, tasks, or focus blocks explicitly supported by the file. For a weekly timetable grid, perform a complete visual inventory: inspect every day column and every time row in reading order, then emit exactly one candidate for every non-empty grid cell. Never summarize, sample, merge, or omit cells because a subject repeats. A single weekday plus start time identifies one grid cell; never return two different candidates for the same weekday/time slot. Set kind to block for weekly timetable cells. Set weekdays to the visible day number where Sunday=0 through Saturday=6. Copy the subject/course label exactly into BOTH title and course. Copy room, faculty, batch, section, code, or other cell details only into notes. Copy the associated row/column time header exactly as 24-hour HH:MM; do not borrow a time or course from an adjacent cell. Before responding, cross-check that each non-empty grid cell has one output and that title, course, weekday, and time agree within that same cell. Use YYYY-MM-DD only when a date is clear; otherwise leave date blank. If text, day, or time is illegible, leave only that field blank instead of guessing. Never invent dates, times, course names, weekdays, rooms, or recurrences. Confidence must be between 0 and 1." },
      { role: "user", content },
    ],
    response_format: { type: "json_schema", json_schema: { name: "schedule_candidates", strict: true, schema: extractionSchema } },
  });
  const responseText = response.choices[0]?.message?.content;
  return normalizeCandidates(parseModelCandidates(responseText));
}

export async function extractUploadedSchedule(userId: number, input: UploadedSchedule) {
  const buffer = decodeBase64(input.contentBase64);
  const mimeType = input.mimeType || "application/octet-stream";
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120) || "schedule-upload";
  const stored = await storagePut(`users/${userId}/schedule-imports/${Date.now()}-${randomUUID()}-${safeName}`, buffer, mimeType);
  const lowerName = input.fileName.toLowerCase();
  let candidates: ScheduleCandidate[];
  let extractionMode: "structured" | "document" | "vision";
  if (lowerName.endsWith(".ics") || mimeType.includes("calendar")) {
    candidates = icsCandidates(buffer.toString("utf8"));
    extractionMode = "structured";
  } else if (lowerName.endsWith(".csv") || mimeType === "text/csv") {
    candidates = rowCandidates(csvRows(buffer.toString("utf8")));
    extractionMode = "structured";
  } else if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls") || mimeType.includes("spreadsheet")) {
    candidates = await workbookCandidates(buffer);
    extractionMode = "structured";
  } else if (lowerName.endsWith(".docx") || mimeType.includes("wordprocessingml")) {
    const result = await mammoth.extractRawText({ buffer });
    candidates = await modelCandidates(input.fileName, mimeType, buffer, result.value);
    extractionMode = "document";
  } else if (mimeType.startsWith("image/")) {
    candidates = await modelCandidates(input.fileName, mimeType, buffer);
    extractionMode = "vision";
  } else if (mimeType === "application/pdf" || lowerName.endsWith(".pdf")) {
    candidates = await modelCandidates(input.fileName, "application/pdf", buffer);
    extractionMode = "document";
  } else {
    throw new Error("Supported uploads are PDF, image, DOCX, XLS/XLSX, CSV, and ICS files. Please convert older .doc files to DOCX or PDF.");
  }
  return { file: { name: input.fileName, mimeType, storageKey: stored.key }, extractionMode, candidates: candidates.slice(0, 120) };
}
