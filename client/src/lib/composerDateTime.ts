import { isValidImportDate } from "./importDates";

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export function readComposerDateTime(date: string, time: string) {
  if (!isValidImportDate(date)) return null;
  const resolvedTime = time || "09:00";
  if (!timePattern.test(resolvedTime)) return null;
  const value = new Date(`${date}T${resolvedTime}:00`);
  return Number.isNaN(value.getTime()) ? null : value;
}
