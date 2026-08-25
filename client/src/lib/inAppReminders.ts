import type { PlannerBlock } from "./ongoingCalendar";
import { workspaceStorageKey } from "./privateWorkspace";

export type InAppReminderSettings = { popupEnabled: boolean; soundEnabled: boolean };
export type InAppReminderState = { dismissedIds: string[]; snoozedUntil: Record<string, number> };
export type InAppReminderCandidate = { id: string; title: string; source: "task" | "event" | "planner"; startAt: Date; reminderAt: Date; leadMinutes: number };

type ReadableStorage = Pick<Storage, "getItem">;
type WritableStorage = Pick<Storage, "setItem">;

export const defaultInAppReminderSettings: InAppReminderSettings = { popupEnabled: false, soundEnabled: false };
export const defaultInAppReminderState: InAppReminderState = { dismissedIds: [], snoozedUntil: {} };

export function loadInAppReminderSettings(storage: ReadableStorage, scope: string): InAppReminderSettings {
  try { return { ...defaultInAppReminderSettings, ...JSON.parse(storage.getItem(workspaceStorageKey("in-app-reminder-settings", scope)) || "{}") }; } catch { return defaultInAppReminderSettings; }
}

export function loadInAppReminderState(storage: ReadableStorage, scope: string): InAppReminderState {
  try {
    const parsed = JSON.parse(storage.getItem(workspaceStorageKey("in-app-reminder-state", scope)) || "{}");
    const snoozedEntries = parsed.snoozedUntil && typeof parsed.snoozedUntil === "object" ? Object.entries(parsed.snoozedUntil).filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1])) : [];
    return { dismissedIds: Array.isArray(parsed.dismissedIds) ? parsed.dismissedIds.filter((id: unknown): id is string => typeof id === "string").slice(-120) : [], snoozedUntil: Object.fromEntries(snoozedEntries) };
  } catch { return defaultInAppReminderState; }
}

export function saveInAppReminderSettings(storage: WritableStorage, scope: string, settings: InAppReminderSettings) { storage.setItem(workspaceStorageKey("in-app-reminder-settings", scope), JSON.stringify(settings)); }
export function saveInAppReminderState(storage: WritableStorage, scope: string, state: InAppReminderState) { storage.setItem(workspaceStorageKey("in-app-reminder-state", scope), JSON.stringify({ dismissedIds: Array.from(new Set(state.dismissedIds)).slice(-120), snoozedUntil: state.snoozedUntil })); }

export function inAppReminderCandidates(items: PlannerBlock[]): InAppReminderCandidate[] {
  return items.flatMap(item => {
    const leadMinutes = item.reminderLeadMinutes;
    const hasExplicitTime = item.source === "task" || item.hasTime !== false;
    if ((item.source !== "task" && item.source !== "event" && item.source !== "planner") || item.completed || !hasExplicitTime || !leadMinutes || leadMinutes < 0) return [];
    const reminderAt = new Date(item.startAt.getTime() - leadMinutes * 60_000);
    return [{ id: `in-app:${item.source}:${item.id}:${item.startAt.getTime()}`, title: item.title, source: item.source, startAt: item.startAt, reminderAt, leadMinutes }];
  }).sort((left, right) => left.reminderAt.getTime() - right.reminderAt.getTime());
}

export function dueInAppReminder(candidates: InAppReminderCandidate[], state: InAppReminderState, now: Date): InAppReminderCandidate | null {
  const nowMs = now.getTime();
  return candidates.find(candidate => {
    if (state.dismissedIds.includes(candidate.id)) return false;
    const snoozedUntil = state.snoozedUntil[candidate.id];
    if (snoozedUntil) return nowMs >= snoozedUntil && nowMs < snoozedUntil + 90_000;
    return nowMs >= candidate.reminderAt.getTime() && nowMs < candidate.startAt.getTime() + 90_000;
  }) ?? null;
}
