import { readFile } from "node:fs/promises";
import { extractUploadedSchedule } from "../server/scheduleImport";

const image = await readFile("/home/ubuntu/import-validation/gate-2026-examination-schedule.jpeg");

const result = await extractUploadedSchedule(999_001, {
  fileName: "public-gate-schedule.jpeg",
  mimeType: "image/jpeg",
  contentBase64: image.toString("base64"),
});

const serialized = JSON.parse(JSON.stringify(result)) as typeof result;
if (result.extractionMode !== "vision" || !serialized.candidates.length) {
  throw new Error("Interactive image extraction did not return the expected review-only candidates.");
}

console.log(JSON.stringify({
  extractionMode: result.extractionMode,
  candidates: result.candidates.length,
  sample: serialized.candidates.slice(0, 3).map(candidate => ({ title: candidate.title, date: candidate.date, time: candidate.time, weekdays: candidate.weekdays })),
  serializable: true,
  result: "Public JPEG processed into review candidates only; no calendar or task write was performed.",
}, null, 2));
