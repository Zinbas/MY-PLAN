import { and, eq, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { calendarConnections, calendarSyncStates, calendarWatchChannels, googleOAuthStates, InsertUser, linkedCalendars, syncedEvents, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function createGoogleOAuthState(userId: number | null, stateHash: string, expiresAt: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(googleOAuthStates).values({ userId, stateHash, expiresAt });
}

export async function consumeGoogleOAuthState(stateHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const match = await db.select().from(googleOAuthStates).where(eq(googleOAuthStates.stateHash, stateHash)).limit(1);
  const state = match[0];
  if (!state || state.expiresAt < new Date()) return undefined;
  await db.delete(googleOAuthStates).where(and(eq(googleOAuthStates.id, state.id), eq(googleOAuthStates.stateHash, stateHash)));
  return state;
}

export async function upsertGoogleCalendarConnection(input: {
  userId: number;
  googleSubject: string;
  email: string;
  accountType: "google" | "workspace";
  scopes: string | null;
  encryptedAccessToken: string;
  encryptedRefreshToken: string | null;
  accessTokenExpiresAt: Date | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(calendarConnections).values({ ...input, status: "connected" }).onDuplicateKeyUpdate({
    set: {
      googleSubject: input.googleSubject,
      accountType: input.accountType,
      status: "connected",
      scopes: input.scopes,
      encryptedAccessToken: input.encryptedAccessToken,
      encryptedRefreshToken: input.encryptedRefreshToken,
      accessTokenExpiresAt: input.accessTokenExpiresAt,
    },
  });
  const result = await db.select().from(calendarConnections).where(and(eq(calendarConnections.userId, input.userId), eq(calendarConnections.email, input.email))).limit(1);
  return result[0];
}

export async function listUserCalendarConnections(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const connections = await db.select().from(calendarConnections).where(eq(calendarConnections.userId, userId));
  const calendars = connections.length
    ? await db.select().from(linkedCalendars)
    : [];
  return connections.map(connection => ({
    ...connection,
    calendars: calendars.filter(calendar => calendar.connectionId === connection.id).map(calendar => ({
      id: calendar.id,
      summary: calendar.summary,
      accessRole: calendar.accessRole,
      isPrimary: calendar.isPrimary,
      isVisible: calendar.isVisible,
    })),
  }));
}

export async function getOwnedCalendarConnection(userId: number, connectionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return (await db.select().from(calendarConnections).where(and(eq(calendarConnections.userId, userId), eq(calendarConnections.id, connectionId))).limit(1))[0];
}

export async function upsertLinkedCalendar(input: { connectionId: number; externalCalendarId: string; summary: string; timeZone: string | null; color: string | null; accessRole: string | null; isPrimary: boolean; isVisible: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(linkedCalendars).values(input).onDuplicateKeyUpdate({ set: { summary: input.summary, timeZone: input.timeZone, color: input.color, accessRole: input.accessRole, isPrimary: input.isPrimary, isVisible: input.isVisible } });
  return (await db.select().from(linkedCalendars).where(and(eq(linkedCalendars.connectionId, input.connectionId), eq(linkedCalendars.externalCalendarId, input.externalCalendarId))).limit(1))[0];
}

export async function listOwnedLinkedCalendars(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const connections = await db.select().from(calendarConnections).where(eq(calendarConnections.userId, userId));
  if (!connections.length) return [];
  const calendars = await db.select().from(linkedCalendars);
  return calendars.filter(calendar => connections.some(connection => connection.id === calendar.connectionId));
}

export async function upsertSyncedEvent(linkedCalendarId: number, event: { externalEventId: string; title: string; description: string | null; startAt: Date; endAt: Date; isAllDay: boolean; eventStatus: string; isDeleted: boolean; googleUpdatedAt: Date | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(syncedEvents).values({ linkedCalendarId, ...event }).onDuplicateKeyUpdate({ set: { title: event.title, description: event.description, startAt: event.startAt, endAt: event.endAt, isAllDay: event.isAllDay, eventStatus: event.eventStatus, isDeleted: event.isDeleted, googleUpdatedAt: event.googleUpdatedAt } });
}

export async function listUserSyncedEvents(userId: number, startAt: Date, endAt: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const calendars = await listOwnedLinkedCalendars(userId);
  if (!calendars.length) return [];
  const rows = await db.select().from(syncedEvents).where(and(gte(syncedEvents.endAt, startAt), lte(syncedEvents.startAt, endAt)));
  return rows.filter(event => calendars.some(calendar => calendar.id === event.linkedCalendarId) && !event.isDeleted);
}

export async function getOwnedLinkedCalendar(userId: number, linkedCalendarId: number) {
  const calendars = await listOwnedLinkedCalendars(userId);
  return calendars.find(calendar => calendar.id === linkedCalendarId);
}

export async function getUserSyncedEvent(userId: number, eventId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const event = (await db.select().from(syncedEvents).where(eq(syncedEvents.id, eventId)).limit(1))[0];
  if (!event) return undefined;
  const calendar = await getOwnedLinkedCalendar(userId, event.linkedCalendarId);
  return calendar ? { event, calendar } : undefined;
}

export async function setCalendarSyncState(linkedCalendarId: number, input: { nextSyncToken?: string | null; syncStatus: "idle" | "syncing" | "healthy" | "attention"; lastError?: string | null; lastSyncedAt?: Date | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(calendarSyncStates).values({ linkedCalendarId, ...input }).onDuplicateKeyUpdate({ set: input });
}

export async function getWatchChannel(channelId: string, verificationToken: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return (await db.select().from(calendarWatchChannels).where(and(eq(calendarWatchChannels.channelId, channelId), eq(calendarWatchChannels.verificationToken, verificationToken))).limit(1))[0];
}

export async function getLinkedCalendarById(linkedCalendarId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return (await db.select().from(linkedCalendars).where(eq(linkedCalendars.id, linkedCalendarId)).limit(1))[0];
}

export async function getCalendarConnectionById(connectionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return (await db.select().from(calendarConnections).where(eq(calendarConnections.id, connectionId)).limit(1))[0];
}

export async function updateConnectionAccessToken(connectionId: number, encryptedAccessToken: string, accessTokenExpiresAt: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(calendarConnections).set({ encryptedAccessToken, accessTokenExpiresAt, status: "connected" }).where(eq(calendarConnections.id, connectionId));
}

export async function getSyncState(linkedCalendarId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return (await db.select().from(calendarSyncStates).where(eq(calendarSyncStates.linkedCalendarId, linkedCalendarId)).limit(1))[0];
}

export async function upsertWatchChannel(input: { linkedCalendarId: number; channelId: string; resourceId: string; verificationToken: string; expiresAt: Date }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(calendarWatchChannels).values(input).onDuplicateKeyUpdate({ set: { resourceId: input.resourceId, verificationToken: input.verificationToken, expiresAt: input.expiresAt } });
}

export async function listExpiringWatchChannels(before: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const rows = await db.select().from(calendarWatchChannels);
  return rows.filter(channel => channel.expiresAt <= before);
}
