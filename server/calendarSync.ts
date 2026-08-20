/**
 * Credential-gated Google Calendar import and incremental synchronization.
 * It is never invoked in demonstration mode and throws clear activation errors instead.
 */
import { randomUUID } from "crypto";
import * as db from "./db";
import { decryptGoogleCredential, encryptGoogleCredential, getGoogleOAuthConfig, isGoogleOAuthConfigured } from "./googleOAuth";
import { listGoogleCalendars, listGoogleEvents, mapGoogleEvent, refreshGoogleAccessToken, watchGoogleCalendar } from "./googleCalendarApi";
import { createGoogleEvent, deleteGoogleEvent, updateGoogleEvent } from "./googleCalendarApi";

export async function getConnectionAccessToken(connection: NonNullable<Awaited<ReturnType<typeof db.getOwnedCalendarConnection>>>) {
  if (!isGoogleOAuthConfigured()) throw new Error("GOOGLE_OAUTH_NOT_CONFIGURED");
  if (connection.encryptedAccessToken && connection.accessTokenExpiresAt && connection.accessTokenExpiresAt.getTime() > Date.now() + 60_000) {
    return decryptGoogleCredential(connection.encryptedAccessToken);
  }
  if (!connection.encryptedRefreshToken) throw new Error("GOOGLE_REAUTH_REQUIRED");
  const refreshed = await refreshGoogleAccessToken(getGoogleOAuthConfig() as Required<ReturnType<typeof getGoogleOAuthConfig>>, decryptGoogleCredential(connection.encryptedRefreshToken));
  await db.updateConnectionAccessToken(connection.id, encryptGoogleCredential(refreshed.access_token), new Date(Date.now() + refreshed.expires_in * 1000));
  return refreshed.access_token;
}

export async function importGoogleCalendarConnection(userId: number, connectionId: number, callbackUrl: string) {
  const connection = await db.getOwnedCalendarConnection(userId, connectionId);
  if (!connection) throw new Error("CONNECTION_NOT_FOUND");
  const accessToken = await getConnectionAccessToken(connection);
  const calendars = await listGoogleCalendars(accessToken);
  const existingCalendars = await db.listOwnedLinkedCalendars(userId);
  const discovered = [] as number[];
  for (const calendar of calendars.filter(calendar => calendar.id && calendar.selected !== false)) {
    const existing = existingCalendars.find(item => item.connectionId === connectionId && item.externalCalendarId === calendar.id);
    const record = await db.upsertLinkedCalendar({
      connectionId,
      externalCalendarId: calendar.id,
      summary: calendar.summary || "Untitled calendar",
      timeZone: calendar.timeZone ?? null,
      color: calendar.backgroundColor ?? null,
      accessRole: calendar.accessRole ?? null,
      isPrimary: Boolean(calendar.primary),
      isVisible: existing?.isVisible ?? false,
    });
    if (!record) continue;
    discovered.push(record.id);
    if (record.isVisible) await syncSelectedGoogleCalendar(userId, record.id, callbackUrl);
  }
  return discovered;
}

export async function setGoogleCalendarSelection(userId: number, linkedCalendarId: number, isVisible: boolean, callbackUrl: string) {
  const calendar = await db.setOwnedLinkedCalendarVisibility(userId, linkedCalendarId, isVisible);
  if (!calendar) throw new Error("CALENDAR_NOT_FOUND");
  if (isVisible) await syncSelectedGoogleCalendar(userId, linkedCalendarId, callbackUrl);
  return calendar;
}

async function syncSelectedGoogleCalendar(userId: number, linkedCalendarId: number, callbackUrl: string) {
  const calendar = await db.getOwnedLinkedCalendar(userId, linkedCalendarId);
  if (!calendar || !calendar.isVisible) throw new Error("CALENDAR_NOT_FOUND");
  const connection = await db.getOwnedCalendarConnection(userId, calendar.connectionId);
  if (!connection) throw new Error("CONNECTION_NOT_FOUND");
  await syncGoogleLinkedCalendar(connection, calendar.id);
  const accessToken = await getConnectionAccessToken(connection);
  const channelId = randomUUID();
  const verificationToken = randomUUID();
  const watch = await watchGoogleCalendar(accessToken, calendar.externalCalendarId, callbackUrl, channelId, verificationToken);
  await db.upsertWatchChannel({ linkedCalendarId: calendar.id, channelId, verificationToken, resourceId: watch.resourceId, expiresAt: new Date(Number(watch.expiration ?? Date.now() + 24 * 60 * 60 * 1000)) });
}

export async function syncGoogleLinkedCalendar(connection: NonNullable<Awaited<ReturnType<typeof db.getOwnedCalendarConnection>>>, linkedCalendarId: number) {
  const accessToken = await getConnectionAccessToken(connection);
  const calendars = await db.listOwnedLinkedCalendars(connection.userId);
  const calendar = calendars.find(item => item.id === linkedCalendarId && item.connectionId === connection.id && item.isVisible);
  if (!calendar) throw new Error("CALENDAR_NOT_FOUND");
  await db.setCalendarSyncState(linkedCalendarId, { syncStatus: "syncing", lastError: null });
  try {
    const existing = await db.getSyncState(linkedCalendarId);
    const response = await listGoogleEvents(accessToken, calendar.externalCalendarId, existing?.nextSyncToken ?? undefined);
    for (const event of response.items ?? []) await db.upsertSyncedEvent(linkedCalendarId, mapGoogleEvent(event));
    await db.setCalendarSyncState(linkedCalendarId, { syncStatus: "healthy", nextSyncToken: response.nextSyncToken ?? existing?.nextSyncToken ?? null, lastError: null, lastSyncedAt: new Date() });
  } catch (error) {
    await db.setCalendarSyncState(linkedCalendarId, { syncStatus: "attention", lastError: error instanceof Error ? error.message : "Unknown sync error" });
    throw error;
  }
}

async function getLiveCalendar(userId: number, linkedCalendarId: number) {
  const calendar = await db.getOwnedLinkedCalendar(userId, linkedCalendarId);
  if (!calendar) throw new Error("CALENDAR_NOT_FOUND");
  const connection = await db.getCalendarConnectionById(calendar.connectionId);
  if (!connection || connection.userId !== userId) throw new Error("CONNECTION_NOT_FOUND");
  return { calendar, connection };
}

export async function createCalendarEvent(userId: number, linkedCalendarId: number, input: { title: string; description?: string; startAt: Date; endAt: Date; isAllDay?: boolean }) {
  const { calendar, connection } = await getLiveCalendar(userId, linkedCalendarId);
  const googleEvent = await createGoogleEvent(await getConnectionAccessToken(connection), calendar.externalCalendarId, input);
  const mapped = mapGoogleEvent(googleEvent);
  await db.upsertSyncedEvent(calendar.id, mapped);
  return mapped;
}

export async function updateCalendarEvent(userId: number, eventId: number, input: { title: string; description?: string; startAt: Date; endAt: Date; isAllDay?: boolean }) {
  const owned = await db.getUserSyncedEvent(userId, eventId);
  if (!owned) throw new Error("EVENT_NOT_FOUND");
  const connection = await db.getCalendarConnectionById(owned.calendar.connectionId);
  if (!connection) throw new Error("CONNECTION_NOT_FOUND");
  const googleEvent = await updateGoogleEvent(await getConnectionAccessToken(connection), owned.calendar.externalCalendarId, owned.event.externalEventId, input);
  const mapped = mapGoogleEvent(googleEvent);
  await db.upsertSyncedEvent(owned.calendar.id, mapped);
  return mapped;
}

export async function deleteCalendarEvent(userId: number, eventId: number) {
  const owned = await db.getUserSyncedEvent(userId, eventId);
  if (!owned) throw new Error("EVENT_NOT_FOUND");
  const connection = await db.getCalendarConnectionById(owned.calendar.connectionId);
  if (!connection) throw new Error("CONNECTION_NOT_FOUND");
  await deleteGoogleEvent(await getConnectionAccessToken(connection), owned.calendar.externalCalendarId, owned.event.externalEventId);
  await db.upsertSyncedEvent(owned.calendar.id, { ...owned.event, isDeleted: true });
}

export async function renewExpiringGoogleWatchChannels(callbackUrl: string, before = new Date(Date.now() + 12 * 60 * 60 * 1000)) {
  const expiring = await db.listExpiringWatchChannels(before);
  let renewed = 0;
  for (const channel of expiring) {
    const calendar = await db.getLinkedCalendarById(channel.linkedCalendarId);
    if (!calendar || !calendar.isVisible) continue;
    const connection = await db.getCalendarConnectionById(calendar.connectionId);
    if (!connection) continue;
    const accessToken = await getConnectionAccessToken(connection);
    const channelId = randomUUID();
    const verificationToken = randomUUID();
    const watch = await watchGoogleCalendar(accessToken, calendar.externalCalendarId, callbackUrl, channelId, verificationToken);
    await db.upsertWatchChannel({ linkedCalendarId: calendar.id, channelId, verificationToken, resourceId: watch.resourceId, expiresAt: new Date(Number(watch.expiration ?? Date.now() + 24 * 60 * 60 * 1000)) });
    renewed += 1;
  }
  return { renewed, inspected: expiring.length };
}
