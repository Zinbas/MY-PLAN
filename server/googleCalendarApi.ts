/**
 * Google Calendar REST client. Network calls run only after valid user-owned OAuth credentials
 * and a linked connection exist; the mapping functions are independently testable.
 */
import type { GoogleOAuthConfig } from "./googleOAuth";

export type GoogleCalendarListEntry = { id: string; summary?: string; timeZone?: string; backgroundColor?: string; accessRole?: string; primary?: boolean; selected?: boolean };
export type GoogleCalendarEvent = { id: string; summary?: string; description?: string; status?: string; updated?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string } };

type GoogleListResponse<T> = { items?: T[]; nextSyncToken?: string; nextPageToken?: string };

async function googleRequest<T>(path: string, accessToken: string, init: RequestInit = {}) {
  const response = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (!response.ok) throw new Error(`Google Calendar request failed with ${response.status}`);
  return response.json() as Promise<T>;
}

export function mapGoogleEvent(event: GoogleCalendarEvent) {
  const isAllDay = Boolean(event.start?.date && !event.start?.dateTime);
  const startValue = event.start?.dateTime ?? (event.start?.date ? `${event.start.date}T00:00:00.000Z` : undefined);
  const endValue = event.end?.dateTime ?? (event.end?.date ? `${event.end.date}T00:00:00.000Z` : undefined);
  if (!event.id || !startValue || !endValue) throw new Error("Google event is missing an id, start, or end time");
  return {
    externalEventId: event.id,
    title: event.summary || "Untitled event",
    description: event.description ?? null,
    startAt: new Date(startValue),
    endAt: new Date(endValue),
    isAllDay,
    eventStatus: event.status || "confirmed",
    isDeleted: event.status === "cancelled",
    googleUpdatedAt: event.updated ? new Date(event.updated) : null,
  };
}

export async function listGoogleCalendars(accessToken: string) {
  const response = await googleRequest<GoogleListResponse<GoogleCalendarListEntry>>("/users/me/calendarList?minAccessRole=reader", accessToken);
  return response.items ?? [];
}

export async function listGoogleEvents(accessToken: string, calendarId: string, syncToken?: string) {
  const parameters = new URLSearchParams({ singleEvents: "true", maxResults: "2500" });
  if (syncToken) parameters.set("syncToken", syncToken); else parameters.set("showDeleted", "true");
  return googleRequest<GoogleListResponse<GoogleCalendarEvent>>(`/calendars/${encodeURIComponent(calendarId)}/events?${parameters}`, accessToken);
}

export async function createGoogleEvent(accessToken: string, calendarId: string, input: { title: string; description?: string; startAt: Date; endAt: Date; isAllDay?: boolean }) {
  const body = input.isAllDay
    ? { summary: input.title, description: input.description, start: { date: input.startAt.toISOString().slice(0, 10) }, end: { date: input.endAt.toISOString().slice(0, 10) } }
    : { summary: input.title, description: input.description, start: { dateTime: input.startAt.toISOString() }, end: { dateTime: input.endAt.toISOString() } };
  return googleRequest<GoogleCalendarEvent>(`/calendars/${encodeURIComponent(calendarId)}/events`, accessToken, { method: "POST", body: JSON.stringify(body) });
}

export async function updateGoogleEvent(accessToken: string, calendarId: string, eventId: string, input: { title: string; description?: string; startAt: Date; endAt: Date; isAllDay?: boolean }) {
  const body = input.isAllDay
    ? { summary: input.title, description: input.description, start: { date: input.startAt.toISOString().slice(0, 10) }, end: { date: input.endAt.toISOString().slice(0, 10) } }
    : { summary: input.title, description: input.description, start: { dateTime: input.startAt.toISOString() }, end: { dateTime: input.endAt.toISOString() } };
  return googleRequest<GoogleCalendarEvent>(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, accessToken, { method: "PATCH", body: JSON.stringify(body) });
}

export async function deleteGoogleEvent(accessToken: string, calendarId: string, eventId: string) {
  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok && response.status !== 410) throw new Error(`Google Calendar delete failed with ${response.status}`);
}

export async function refreshGoogleAccessToken(config: Required<GoogleOAuthConfig>, refreshToken: string) {
  const body = new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" });
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!response.ok) throw new Error(`Google token refresh failed with ${response.status}`);
  return response.json() as Promise<{ access_token: string; expires_in: number; scope?: string }>;
}

export async function watchGoogleCalendar(accessToken: string, calendarId: string, callbackUrl: string, channelId: string, verificationToken: string) {
  return googleRequest<{ resourceId: string; expiration?: string }>(`/calendars/${encodeURIComponent(calendarId)}/events/watch`, accessToken, {
    method: "POST",
    body: JSON.stringify({ id: channelId, type: "web_hook", address: callbackUrl, token: verificationToken }),
  });
}
