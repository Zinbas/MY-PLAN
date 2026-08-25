import { and, asc, eq, gt, gte, inArray, isNull, lt, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { applicationSessions, calendarConnections, calendarSyncStates, calendarWatchChannels, googleOAuthStates, InsertUser, linkedCalendars, personalReminderItems, pushReminderDeliveries, pushReminderPreferences, pushSubscriptions, sparkAccessTokens, sparkEvents, syncedEvents, users } from "../drizzle/schema";
import { ENV, isAdminGoogleEmail } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch {
      if (!ENV.isProduction) console.warn("[Database] Failed to connect");
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
    if (!ENV.isProduction) console.warn("[Database] Cannot upsert user: database not available");
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
    if (!ENV.isProduction) console.error("[Database] Failed to upsert user");
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    if (!ENV.isProduction) console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function createApplicationSession(input: { userId: number; tokenHash: string; expiresAt: Date }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(applicationSessions).values({ ...input, revokedAt: null, lastSeenAt: new Date() }).onDuplicateKeyUpdate({
    set: { userId: input.userId, expiresAt: input.expiresAt, revokedAt: null, lastSeenAt: new Date() },
  });
}

export async function hasActiveApplicationSession(userId: number, tokenHash: string) {
  const db = await getDb();
  if (!db) return false;
  const session = (await db.select({ id: applicationSessions.id }).from(applicationSessions).where(and(
    eq(applicationSessions.userId, userId),
    eq(applicationSessions.tokenHash, tokenHash),
    isNull(applicationSessions.revokedAt),
    gt(applicationSessions.expiresAt, new Date()),
  )).limit(1))[0];
  return Boolean(session);
}

export async function revokeApplicationSession(tokenHash: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(applicationSessions).set({ revokedAt: new Date() }).where(eq(applicationSessions.tokenHash, tokenHash));
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
  const connections = await db
    .select()
    .from(calendarConnections)
    .where(eq(calendarConnections.userId, userId));
  const connectionIds = connections.map(connection => connection.id);
  const calendars = connectionIds.length
    ? await db.select().from(linkedCalendars).where(inArray(linkedCalendars.connectionId, connectionIds))
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
  const connections = await db
    .select({ id: calendarConnections.id })
    .from(calendarConnections)
    .where(eq(calendarConnections.userId, userId));
  const connectionIds = connections.map(connection => connection.id);
  if (!connectionIds.length) return [];
  return db.select().from(linkedCalendars).where(inArray(linkedCalendars.connectionId, connectionIds));
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
  const visibleCalendarIds = calendars.filter(calendar => calendar.isVisible).map(calendar => calendar.id);
  if (!visibleCalendarIds.length) return [];
  return db
    .select()
    .from(syncedEvents)
    .where(and(
      inArray(syncedEvents.linkedCalendarId, visibleCalendarIds),
      gte(syncedEvents.endAt, startAt),
      lte(syncedEvents.startAt, endAt),
      eq(syncedEvents.isDeleted, false),
    ));
}

export async function getOwnedLinkedCalendar(userId: number, linkedCalendarId: number) {
  const calendars = await listOwnedLinkedCalendars(userId);
  return calendars.find(calendar => calendar.id === linkedCalendarId);
}

export async function getUserSyncedEvent(userId: number, eventId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const calendars = await listOwnedLinkedCalendars(userId);
  const ownedCalendarIds = calendars.map(calendar => calendar.id);
  if (!ownedCalendarIds.length) return undefined;
  const event = (await db
    .select()
    .from(syncedEvents)
    .where(and(eq(syncedEvents.id, eventId), inArray(syncedEvents.linkedCalendarId, ownedCalendarIds)))
    .limit(1))[0];
  if (!event) return undefined;
  const calendar = calendars.find(candidate => candidate.id === event.linkedCalendarId);
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

export type PushPreferenceInput = {
  enabled: boolean;
  defaultLeadMinutes: number;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  timeZone: string | null;
};

export const defaultPushReminderPreferences: PushPreferenceInput = {
  enabled: false,
  defaultLeadMinutes: 10,
  quietHoursStart: null,
  quietHoursEnd: null,
  timeZone: null,
};

export async function getPushReminderPreferences(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const record = (await db.select().from(pushReminderPreferences).where(eq(pushReminderPreferences.userId, userId)).limit(1))[0];
  return record ?? { id: null, userId, ...defaultPushReminderPreferences };
}

export async function upsertPushReminderPreferences(userId: number, input: PushPreferenceInput) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(pushReminderPreferences).values({ userId, ...input }).onDuplicateKeyUpdate({ set: input });
  return getPushReminderPreferences(userId);
}

export async function upsertPushSubscription(input: {
  userId: number;
  endpointHash: string;
  encryptedSubscription: string;
  userAgent: string | null;
  expiresAt: Date | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(pushSubscriptions).values({ ...input, status: "active", lastError: null }).onDuplicateKeyUpdate({
    set: { userId: input.userId, encryptedSubscription: input.encryptedSubscription, userAgent: input.userAgent, expiresAt: input.expiresAt, status: "active", lastError: null },
  });
  return (await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpointHash, input.endpointHash)).limit(1))[0];
}

export async function listOwnedPushSubscriptions(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.select({ id: pushSubscriptions.id, status: pushSubscriptions.status, userAgent: pushSubscriptions.userAgent, expiresAt: pushSubscriptions.expiresAt, createdAt: pushSubscriptions.createdAt, updatedAt: pushSubscriptions.updatedAt })
    .from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
}

export async function getOwnedPushSubscriptionStatus(userId: number, endpointHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const subscription = (await db.select({ status: pushSubscriptions.status, expiresAt: pushSubscriptions.expiresAt })
    .from(pushSubscriptions).where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpointHash, endpointHash))).limit(1))[0];
  const connected = Boolean(subscription?.status === "active" && (!subscription.expiresAt || subscription.expiresAt > new Date()));
  return { connected } as const;
}

export async function listActivePushSubscriptions(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.select().from(pushSubscriptions).where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.status, "active")));
}

export async function revokeOwnedPushSubscription(userId: number, subscriptionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(pushSubscriptions).set({ status: "revoked", encryptedSubscription: "", lastError: null }).where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.id, subscriptionId)));
}

export async function revokeAllOwnedPushSubscriptions(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(pushSubscriptions).set({ status: "revoked", encryptedSubscription: "", lastError: null }).where(eq(pushSubscriptions.userId, userId));
}

export async function upsertPushReminderDelivery(input: {
  userId: number;
  deliveryKey: string;
  sourceKind: "task" | "event" | "block";
  sourceId: string;
  title: string;
  body: string;
  targetSection: "calendar" | "todo";
  scheduledAt: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(pushReminderDeliveries).values({ ...input }).onDuplicateKeyUpdate({
    set: { sourceKind: input.sourceKind, sourceId: input.sourceId, title: input.title, body: input.body, targetSection: input.targetSection, scheduledAt: input.scheduledAt, state: "pending", claimToken: null, claimedAt: null, sentAt: null },
  });
}

export async function cancelOwnedPushReminderDeliveries(userId: number, deliveryKeys: string[]) {
  const db = await getDb();
  if (!db || !deliveryKeys.length) return;
  await db.update(pushReminderDeliveries).set({ state: "cancelled" }).where(and(eq(pushReminderDeliveries.userId, userId), inArray(pushReminderDeliveries.deliveryKey, deliveryKeys)));
}

export type PersonalReminderEnrollmentInput = {
  sourceKind: "task" | "event" | "block";
  sourceId: string;
  title: string;
  body: string;
  targetSection: "calendar" | "todo";
  occursAt: Date;
  leadMinutes?: number;
  deliveryKey: string;
  scheduledAt: Date;
};

/**
 * Stores only the minimal metadata a user explicitly selected for off-app reminders.
 * Existing delivery keys remain unchanged for identical items so an already-sent reminder
 * cannot become pending again during a later manual refresh.
 */
export async function syncOwnedPersonalReminderItems(userId: number, items: PersonalReminderEnrollmentInput[]) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const existing = await db.select().from(personalReminderItems)
    .where(and(eq(personalReminderItems.userId, userId), eq(personalReminderItems.isActive, true)));
  const existingBySource = new Map(existing.map(item => [`${item.sourceKind}:${item.sourceId}`, item]));
  const incomingSources = new Set(items.map(item => `${item.sourceKind}:${item.sourceId}`));
  const stale = existing.filter(item => !incomingSources.has(`${item.sourceKind}:${item.sourceId}`));
  const itemsToSchedule = items.filter(item => {
    const current = existingBySource.get(`${item.sourceKind}:${item.sourceId}`);
    return !current || current.deliveryKey !== item.deliveryKey || current.title !== item.title || current.body !== item.body || current.targetSection !== item.targetSection || current.occursAt.getTime() !== item.occursAt.getTime() || current.leadMinutes !== item.leadMinutes;
  });

  for (const item of items) {
    const { scheduledAt: _scheduledAt, ...record } = item;
    await db.insert(personalReminderItems).values({ userId, ...record, isActive: true }).onDuplicateKeyUpdate({
      set: { title: item.title, body: item.body, targetSection: item.targetSection, occursAt: item.occursAt, leadMinutes: item.leadMinutes ?? null, deliveryKey: item.deliveryKey, isActive: true },
    });
  }
  if (stale.length) {
    await db.update(personalReminderItems).set({ isActive: false })
      .where(and(eq(personalReminderItems.userId, userId), inArray(personalReminderItems.id, stale.map(item => item.id))));
  }
  return {
    activeCount: items.length,
    itemsToSchedule,
    deliveryKeysToCancel: [...stale.map(item => item.deliveryKey), ...itemsToSchedule.flatMap(item => {
      const current = existingBySource.get(`${item.sourceKind}:${item.sourceId}`);
      return current && current.deliveryKey !== item.deliveryKey ? [current.deliveryKey] : [];
    })],
  };
}

export async function getOwnedPersonalReminderEnrollmentSummary(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const items = await db.select({ id: personalReminderItems.id, updatedAt: personalReminderItems.updatedAt })
    .from(personalReminderItems)
    .where(and(eq(personalReminderItems.userId, userId), eq(personalReminderItems.isActive, true)));
  return {
    activeCount: items.length,
    lastUpdatedAt: items.reduce<Date | null>((latest, item) => !latest || item.updatedAt > latest ? item.updatedAt : latest, null),
  };
}

export async function clearOwnedPersonalReminderItems(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const items = await db.select({ id: personalReminderItems.id, deliveryKey: personalReminderItems.deliveryKey })
    .from(personalReminderItems)
    .where(and(eq(personalReminderItems.userId, userId), eq(personalReminderItems.isActive, true)));
  if (items.length) {
    await db.update(personalReminderItems).set({ isActive: false })
      .where(and(eq(personalReminderItems.userId, userId), inArray(personalReminderItems.id, items.map(item => item.id))));
  }
  return items.map(item => item.deliveryKey);
}

export type ClaimedPushReminderDelivery = typeof pushReminderDeliveries.$inferSelect;

/** Requeue claims left behind by an interrupted dispatcher without trusting caller-controlled data. */
export async function requeueStalePushReminderDeliveryClaims(staleBefore: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(pushReminderDeliveries).set({ state: "pending", claimToken: null, claimedAt: null })
    .where(and(eq(pushReminderDeliveries.state, "claimed"), lt(pushReminderDeliveries.claimedAt, staleBefore)));
}

/** Discard deliveries that pre-date activation or an outage window instead of sending stale reminders. */
export async function skipExpiredPendingPushReminderDeliveries(expiredBefore: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(pushReminderDeliveries).set({ state: "skipped", claimToken: null, claimedAt: null })
    .where(and(eq(pushReminderDeliveries.state, "pending"), lt(pushReminderDeliveries.scheduledAt, expiredBefore)));
}

/**
 * Atomically claim a bounded batch of due records. A conditional state update makes duplicate
 * Heartbeat deliveries harmless when two calls overlap.
 */
export async function claimDuePushReminderDeliveries(now: Date, limit: number, claimToken: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const due = await db.select().from(pushReminderDeliveries)
    .where(and(eq(pushReminderDeliveries.state, "pending"), lte(pushReminderDeliveries.scheduledAt, now)))
    .orderBy(asc(pushReminderDeliveries.scheduledAt)).limit(limit);
  const claimed: ClaimedPushReminderDelivery[] = [];
  for (const delivery of due) {
    await db.update(pushReminderDeliveries).set({
      state: "claimed",
      claimToken,
      claimedAt: now,
      attemptCount: delivery.attemptCount + 1,
    }).where(and(eq(pushReminderDeliveries.id, delivery.id), eq(pushReminderDeliveries.state, "pending")));
    const current = (await db.select().from(pushReminderDeliveries).where(and(
      eq(pushReminderDeliveries.id, delivery.id),
      eq(pushReminderDeliveries.state, "claimed"),
      eq(pushReminderDeliveries.claimToken, claimToken),
    )).limit(1))[0];
    if (current) claimed.push(current);
  }
  return claimed;
}

export async function markPushReminderDeliverySent(deliveryId: number, claimToken: string, sentAt: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(pushReminderDeliveries).set({ state: "sent", sentAt, claimToken: null, claimedAt: null })
    .where(and(eq(pushReminderDeliveries.id, deliveryId), eq(pushReminderDeliveries.state, "claimed"), eq(pushReminderDeliveries.claimToken, claimToken)));
}

export async function deferClaimedPushReminderDelivery(deliveryId: number, claimToken: string, scheduledAt: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(pushReminderDeliveries).set({ state: "pending", scheduledAt, claimToken: null, claimedAt: null })
    .where(and(eq(pushReminderDeliveries.id, deliveryId), eq(pushReminderDeliveries.state, "claimed"), eq(pushReminderDeliveries.claimToken, claimToken)));
}

export async function skipClaimedPushReminderDelivery(deliveryId: number, claimToken: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(pushReminderDeliveries).set({ state: "skipped", claimToken: null, claimedAt: null })
    .where(and(eq(pushReminderDeliveries.id, deliveryId), eq(pushReminderDeliveries.state, "claimed"), eq(pushReminderDeliveries.claimToken, claimToken)));
}

export async function expirePushSubscription(subscriptionId: number, reason: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(pushSubscriptions).set({ status: "expired", encryptedSubscription: "", lastError: reason.slice(0, 255) })
    .where(and(eq(pushSubscriptions.id, subscriptionId), eq(pushSubscriptions.status, "active")));
}
