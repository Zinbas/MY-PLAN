import { and, eq, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { calendarConnections, calendarSyncStates, calendarWatchChannels, googleOAuthStates, InsertUser, linkedCalendars, sparkAccessTokens, sparkEvents, syncedEvents, users } from "../drizzle/schema";
import { ENV, isAdminGoogleEmail } from './_core/env';
import { calendarsForConnections, connectionsForUser, visibleEventsForCalendars } from "./calendarOwnership";

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
    } else if (user.openId === ENV.ownerOpenId || isAdminGoogleEmail(user.email)) {
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
  const connections = connectionsForUser(await db.select().from(calendarConnections), userId);
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

export async function getAdminOverview() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [allUsers, connections, calendars] = await Promise.all([
    db.select({ id: users.id }).from(users),
    db.select({ id: calendarConnections.id }).from(calendarConnections),
    db.select({ id: linkedCalendars.id, isVisible: linkedCalendars.isVisible }).from(linkedCalendars),
  ]);
  return {
    accountCount: allUsers.length,
    connectedAccountCount: connections.length,
    selectedCalendarCount: calendars.filter(calendar => calendar.isVisible).length,
  };
}

export async function listAdminUserDirectory() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [allUsers, connections, calendars] = await Promise.all([
    db.select().from(users),
    db.select().from(calendarConnections),
    db.select().from(linkedCalendars),
  ]);
  return allUsers.map(user => {
    const userConnections = connections.filter(connection => connection.userId === user.id);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      lastSignedIn: user.lastSignedIn,
      connectionCount: userConnections.length,
      selectedCalendarCount: calendars.filter(calendar => calendar.isVisible && userConnections.some(connection => connection.id === calendar.connectionId)).length,
    };
  });
}

export function roleChangeGuardrail(actorUserId: number, targetUserId: number, targetEmail: string | null, role: "admin" | "user") {
  if (actorUserId === targetUserId) return "Administrators cannot change their own role.";
  if (isAdminGoogleEmail(targetEmail) && role !== "admin") return "The designated MY PLAN administrator cannot be demoted.";
  return null;
}

export async function setManagedUserRole(actorUserId: number, targetUserId: number, role: "admin" | "user") {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const target = (await db.select().from(users).where(eq(users.id, targetUserId)).limit(1))[0];
  if (!target) return undefined;
  const denied = roleChangeGuardrail(actorUserId, targetUserId, target.email, role);
  if (denied) throw new Error(denied);
  await db.update(users).set({ role }).where(eq(users.id, targetUserId));
  return { id: targetUserId, role };
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
  const connections = connectionsForUser(await db.select().from(calendarConnections), userId);
  if (!connections.length) return [];
  return calendarsForConnections(await db.select().from(linkedCalendars), connections);
}

export async function setOwnedLinkedCalendarVisibility(userId: number, linkedCalendarId: number, isVisible: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const calendar = await getOwnedLinkedCalendar(userId, linkedCalendarId);
  if (!calendar) return undefined;
  await db.update(linkedCalendars).set({ isVisible }).where(eq(linkedCalendars.id, linkedCalendarId));
  return { ...calendar, isVisible };
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
  return visibleEventsForCalendars(rows, calendars);
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

export async function replaceSparkAccessToken(userId: number, tokenHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(sparkAccessTokens).where(eq(sparkAccessTokens.userId, userId));
  await db.insert(sparkAccessTokens).values({ userId, tokenHash });
}

export async function getSparkTokenOwner(tokenHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const token = (await db.select().from(sparkAccessTokens).where(eq(sparkAccessTokens.tokenHash, tokenHash)).limit(1))[0];
  if (!token) return undefined;
  await db.update(sparkAccessTokens).set({ lastUsedAt: new Date() }).where(eq(sparkAccessTokens.id, token.id));
  return token.userId;
}

export async function listSparkEvents(userId: number, startAt: Date, endAt: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.select().from(sparkEvents).where(and(eq(sparkEvents.userId, userId), gte(sparkEvents.endAt, startAt), lte(sparkEvents.startAt, endAt)));
}

export async function createSparkEvent(userId: number, input: { title: string; description?: string | null; startAt: Date; endAt: Date }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const created = await db.insert(sparkEvents).values({ userId, ...input });
  return (await db.select().from(sparkEvents).where(and(eq(sparkEvents.userId, userId), eq(sparkEvents.id, Number(created[0].insertId)))).limit(1))[0];
}

export async function updateSparkEvent(userId: number, eventId: number, input: { title: string; description?: string | null; startAt: Date; endAt: Date }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(sparkEvents).set(input).where(and(eq(sparkEvents.userId, userId), eq(sparkEvents.id, eventId)));
  return (await db.select().from(sparkEvents).where(and(eq(sparkEvents.userId, userId), eq(sparkEvents.id, eventId))).limit(1))[0];
}

export async function deleteSparkEvent(userId: number, eventId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(sparkEvents).where(and(eq(sparkEvents.userId, userId), eq(sparkEvents.id, eventId)));
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
