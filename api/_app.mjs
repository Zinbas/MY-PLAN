// server/_core/app.ts
import express2 from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var SESSION_TTL_MS = 1e3 * 60 * 60 * 24 * 30;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
var OAUTH_STATE_COOKIE = "__Host-oauth_state";
var decodeOAuthState = (state) => {
  let decoded;
  try {
    decoded = atob(state);
  } catch {
    return { redirectUri: "" };
  }
  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.redirectUri === "string") return parsed;
  } catch {
  }
  return { redirectUri: decoded };
};

// server/_core/oauth.ts
import { parse as parseCookieHeader2 } from "cookie";

// server/db.ts
import { and, asc, eq, gt, gte, inArray, isNull, lt, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

// drizzle/schema.ts
import { boolean, index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var applicationSessions = mysqlTable("applicationSessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  revokedAt: timestamp("revokedAt"),
  lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
}, (table) => [index("applicationSessions_user_status_idx").on(table.userId, table.revokedAt, table.expiresAt)]);
var calendarConnections = mysqlTable("calendarConnections", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  googleSubject: varchar("googleSubject", { length: 255 }),
  email: varchar("email", { length: 320 }).notNull(),
  accountType: mysqlEnum("accountType", ["google", "workspace", "demo"]).notNull(),
  status: mysqlEnum("status", ["pending", "connected", "reauth_required", "disconnected", "demo"]).notNull().default("pending"),
  scopes: text("scopes"),
  encryptedAccessToken: text("encryptedAccessToken"),
  encryptedRefreshToken: text("encryptedRefreshToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
}, (table) => [
  uniqueIndex("calendarConnections_user_email_unique").on(table.userId, table.email),
  index("calendarConnections_user_idx").on(table.userId)
]);
var linkedCalendars = mysqlTable("linkedCalendars", {
  id: int("id").autoincrement().primaryKey(),
  connectionId: int("connectionId").notNull().references(() => calendarConnections.id, { onDelete: "cascade" }),
  externalCalendarId: varchar("externalCalendarId", { length: 512 }).notNull(),
  summary: varchar("summary", { length: 255 }).notNull(),
  timeZone: varchar("timeZone", { length: 128 }),
  color: varchar("color", { length: 32 }),
  accessRole: varchar("accessRole", { length: 64 }),
  isPrimary: boolean("isPrimary").notNull().default(false),
  isVisible: boolean("isVisible").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
}, (table) => [
  uniqueIndex("linkedCalendars_connection_external_unique").on(table.connectionId, table.externalCalendarId),
  index("linkedCalendars_connection_idx").on(table.connectionId)
]);
var syncedEvents = mysqlTable("syncedEvents", {
  id: int("id").autoincrement().primaryKey(),
  linkedCalendarId: int("linkedCalendarId").notNull().references(() => linkedCalendars.id, { onDelete: "cascade" }),
  externalEventId: varchar("externalEventId", { length: 1024 }).notNull(),
  title: varchar("title", { length: 1024 }).notNull(),
  description: text("description"),
  startAt: timestamp("startAt").notNull(),
  endAt: timestamp("endAt").notNull(),
  isAllDay: boolean("isAllDay").notNull().default(false),
  eventStatus: varchar("eventStatus", { length: 64 }).notNull().default("confirmed"),
  isDeleted: boolean("isDeleted").notNull().default(false),
  googleUpdatedAt: timestamp("googleUpdatedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
}, (table) => [
  uniqueIndex("syncedEvents_calendar_external_unique").on(table.linkedCalendarId, table.externalEventId),
  index("syncedEvents_calendar_start_idx").on(table.linkedCalendarId, table.startAt)
]);
var calendarSyncStates = mysqlTable("calendarSyncStates", {
  id: int("id").autoincrement().primaryKey(),
  linkedCalendarId: int("linkedCalendarId").notNull().references(() => linkedCalendars.id, { onDelete: "cascade" }).unique(),
  nextSyncToken: text("nextSyncToken"),
  lastSyncedAt: timestamp("lastSyncedAt"),
  lastError: text("lastError"),
  syncStatus: mysqlEnum("syncStatus", ["idle", "syncing", "healthy", "attention"]).notNull().default("idle"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var calendarWatchChannels = mysqlTable("calendarWatchChannels", {
  id: int("id").autoincrement().primaryKey(),
  linkedCalendarId: int("linkedCalendarId").notNull().references(() => linkedCalendars.id, { onDelete: "cascade" }),
  channelId: varchar("channelId", { length: 128 }).notNull().unique(),
  resourceId: varchar("resourceId", { length: 512 }).notNull(),
  verificationToken: varchar("verificationToken", { length: 256 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => [index("calendarWatchChannels_calendar_idx").on(table.linkedCalendarId)]);
var googleOAuthStates = mysqlTable("googleOAuthStates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id, { onDelete: "cascade" }),
  stateHash: varchar("stateHash", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => [index("googleOAuthStates_user_idx").on(table.userId)]);
var sparkAccessTokens = mysqlTable("sparkAccessTokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("tokenHash", { length: 128 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  lastUsedAt: timestamp("lastUsedAt")
}, (table) => [uniqueIndex("sparkAccessTokens_user_unique").on(table.userId)]);
var sparkEvents = mysqlTable("sparkEvents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 1024 }).notNull(),
  description: text("description"),
  startAt: timestamp("startAt").notNull(),
  endAt: timestamp("endAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
}, (table) => [index("sparkEvents_user_start_idx").on(table.userId, table.startAt)]);
var pushReminderPreferences = mysqlTable("pushReminderPreferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  enabled: boolean("enabled").notNull().default(false),
  defaultLeadMinutes: int("defaultLeadMinutes").notNull().default(10),
  quietHoursStart: varchar("quietHoursStart", { length: 5 }),
  quietHoursEnd: varchar("quietHoursEnd", { length: 5 }),
  timeZone: varchar("timeZone", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var pushSubscriptions = mysqlTable("pushSubscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  endpointHash: varchar("endpointHash", { length: 128 }).notNull().unique(),
  encryptedSubscription: text("encryptedSubscription").notNull(),
  userAgent: varchar("userAgent", { length: 512 }),
  expiresAt: timestamp("expiresAt"),
  status: mysqlEnum("status", ["active", "revoked", "expired"]).notNull().default("active"),
  lastError: varchar("lastError", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
}, (table) => [index("pushSubscriptions_user_status_idx").on(table.userId, table.status)]);
var pushReminderDeliveries = mysqlTable("pushReminderDeliveries", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  deliveryKey: varchar("deliveryKey", { length: 128 }).notNull().unique(),
  sourceKind: mysqlEnum("sourceKind", ["task", "event", "block"]).notNull(),
  sourceId: varchar("sourceId", { length: 255 }).notNull(),
  title: varchar("title", { length: 1024 }).notNull(),
  body: varchar("body", { length: 512 }).notNull(),
  targetSection: mysqlEnum("targetSection", ["calendar", "todo"]).notNull(),
  scheduledAt: timestamp("scheduledAt").notNull(),
  state: mysqlEnum("state", ["pending", "claimed", "sent", "skipped", "cancelled"]).notNull().default("pending"),
  attemptCount: int("attemptCount").notNull().default(0),
  claimToken: varchar("claimToken", { length: 128 }),
  claimedAt: timestamp("claimedAt"),
  sentAt: timestamp("sentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
}, (table) => [
  index("pushReminderDeliveries_due_idx").on(table.state, table.scheduledAt),
  index("pushReminderDeliveries_user_idx").on(table.userId)
]);
var personalReminderItems = mysqlTable("personalReminderItems", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  sourceKind: mysqlEnum("sourceKind", ["task", "event", "block"]).notNull(),
  sourceId: varchar("sourceId", { length: 255 }).notNull(),
  title: varchar("title", { length: 1024 }).notNull(),
  body: varchar("body", { length: 512 }).notNull(),
  targetSection: mysqlEnum("targetSection", ["calendar", "todo"]).notNull(),
  occursAt: timestamp("occursAt").notNull(),
  leadMinutes: int("leadMinutes"),
  deliveryKey: varchar("deliveryKey", { length: 128 }).notNull(),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
}, (table) => [
  uniqueIndex("personalReminderItems_user_source_unique").on(table.userId, table.sourceKind, table.sourceId),
  index("personalReminderItems_user_active_idx").on(table.userId, table.isActive, table.occursAt)
]);

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  adminGoogleEmail: process.env.ADMIN_GOOGLE_EMAIL?.trim().toLowerCase() ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
};
function isAdminGoogleEmail(email) {
  return Boolean(ENV.adminGoogleEmail) && email?.trim().toLowerCase() === ENV.adminGoogleEmail;
}

// server/db.ts
var _db = null;
async function getDb() {
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
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    if (!ENV.isProduction) console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values = {
      openId: user.openId
    };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId || isAdminGoogleEmail(user.email)) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = /* @__PURE__ */ new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet
    });
  } catch (error) {
    if (!ENV.isProduction) console.error("[Database] Failed to upsert user");
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) {
    if (!ENV.isProduction) console.warn("[Database] Cannot get user: database not available");
    return void 0;
  }
  const result2 = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result2.length > 0 ? result2[0] : void 0;
}
async function createApplicationSession(input) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(applicationSessions).values({ ...input, revokedAt: null, lastSeenAt: /* @__PURE__ */ new Date() }).onDuplicateKeyUpdate({
    set: { userId: input.userId, expiresAt: input.expiresAt, revokedAt: null, lastSeenAt: /* @__PURE__ */ new Date() }
  });
}
async function hasActiveApplicationSession(userId, tokenHash) {
  const db = await getDb();
  if (!db) return false;
  const session = (await db.select({ id: applicationSessions.id }).from(applicationSessions).where(and(
    eq(applicationSessions.userId, userId),
    eq(applicationSessions.tokenHash, tokenHash),
    isNull(applicationSessions.revokedAt),
    gt(applicationSessions.expiresAt, /* @__PURE__ */ new Date())
  )).limit(1))[0];
  return Boolean(session);
}
async function revokeApplicationSession(tokenHash) {
  const db = await getDb();
  if (!db) return;
  await db.update(applicationSessions).set({ revokedAt: /* @__PURE__ */ new Date() }).where(eq(applicationSessions.tokenHash, tokenHash));
}
async function createGoogleOAuthState(userId, stateHash, expiresAt) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(googleOAuthStates).values({ userId, stateHash, expiresAt });
}
async function consumeGoogleOAuthState(stateHash) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const match = await db.select().from(googleOAuthStates).where(eq(googleOAuthStates.stateHash, stateHash)).limit(1);
  const state = match[0];
  if (!state || state.expiresAt < /* @__PURE__ */ new Date()) return void 0;
  await db.delete(googleOAuthStates).where(and(eq(googleOAuthStates.id, state.id), eq(googleOAuthStates.stateHash, stateHash)));
  return state;
}
async function upsertGoogleCalendarConnection(input) {
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
      accessTokenExpiresAt: input.accessTokenExpiresAt
    }
  });
  const result2 = await db.select().from(calendarConnections).where(and(eq(calendarConnections.userId, input.userId), eq(calendarConnections.email, input.email))).limit(1);
  return result2[0];
}
async function listUserCalendarConnections(userId) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const connections = await db.select().from(calendarConnections).where(eq(calendarConnections.userId, userId));
  const connectionIds = connections.map((connection) => connection.id);
  const calendars = connectionIds.length ? await db.select().from(linkedCalendars).where(inArray(linkedCalendars.connectionId, connectionIds)) : [];
  return connections.map((connection) => ({
    ...connection,
    calendars: calendars.filter((calendar) => calendar.connectionId === connection.id).map((calendar) => ({
      id: calendar.id,
      summary: calendar.summary,
      accessRole: calendar.accessRole,
      isPrimary: calendar.isPrimary,
      isVisible: calendar.isVisible
    }))
  }));
}
async function getAdminOverview() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [allUsers, connections, calendars] = await Promise.all([
    db.select({ id: users.id }).from(users),
    db.select({ id: calendarConnections.id }).from(calendarConnections),
    db.select({ id: linkedCalendars.id, isVisible: linkedCalendars.isVisible }).from(linkedCalendars)
  ]);
  return {
    accountCount: allUsers.length,
    connectedAccountCount: connections.length,
    selectedCalendarCount: calendars.filter((calendar) => calendar.isVisible).length
  };
}
async function listAdminUserDirectory() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [allUsers, connections, calendars] = await Promise.all([
    db.select().from(users),
    db.select().from(calendarConnections),
    db.select().from(linkedCalendars)
  ]);
  return allUsers.map((user) => {
    const userConnections = connections.filter((connection) => connection.userId === user.id);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      lastSignedIn: user.lastSignedIn,
      connectionCount: userConnections.length,
      selectedCalendarCount: calendars.filter((calendar) => calendar.isVisible && userConnections.some((connection) => connection.id === calendar.connectionId)).length
    };
  });
}
function roleChangeGuardrail(actorUserId, targetUserId, targetEmail, role) {
  if (actorUserId === targetUserId) return "Administrators cannot change their own role.";
  if (isAdminGoogleEmail(targetEmail) && role !== "admin") return "The designated MY PLAN administrator cannot be demoted.";
  return null;
}
async function setManagedUserRole(actorUserId, targetUserId, role) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const target = (await db.select().from(users).where(eq(users.id, targetUserId)).limit(1))[0];
  if (!target) return void 0;
  const denied = roleChangeGuardrail(actorUserId, targetUserId, target.email, role);
  if (denied) throw new Error(denied);
  await db.update(users).set({ role }).where(eq(users.id, targetUserId));
  return { id: targetUserId, role };
}
async function getOwnedCalendarConnection(userId, connectionId) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return (await db.select().from(calendarConnections).where(and(eq(calendarConnections.userId, userId), eq(calendarConnections.id, connectionId))).limit(1))[0];
}
async function upsertLinkedCalendar(input) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(linkedCalendars).values(input).onDuplicateKeyUpdate({ set: { summary: input.summary, timeZone: input.timeZone, color: input.color, accessRole: input.accessRole, isPrimary: input.isPrimary, isVisible: input.isVisible } });
  return (await db.select().from(linkedCalendars).where(and(eq(linkedCalendars.connectionId, input.connectionId), eq(linkedCalendars.externalCalendarId, input.externalCalendarId))).limit(1))[0];
}
async function listOwnedLinkedCalendars(userId) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const connections = await db.select({ id: calendarConnections.id }).from(calendarConnections).where(eq(calendarConnections.userId, userId));
  const connectionIds = connections.map((connection) => connection.id);
  if (!connectionIds.length) return [];
  return db.select().from(linkedCalendars).where(inArray(linkedCalendars.connectionId, connectionIds));
}
async function setOwnedLinkedCalendarVisibility(userId, linkedCalendarId, isVisible) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const calendar = await getOwnedLinkedCalendar(userId, linkedCalendarId);
  if (!calendar) return void 0;
  await db.update(linkedCalendars).set({ isVisible }).where(eq(linkedCalendars.id, linkedCalendarId));
  return { ...calendar, isVisible };
}
async function upsertSyncedEvent(linkedCalendarId, event) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(syncedEvents).values({ linkedCalendarId, ...event }).onDuplicateKeyUpdate({ set: { title: event.title, description: event.description, startAt: event.startAt, endAt: event.endAt, isAllDay: event.isAllDay, eventStatus: event.eventStatus, isDeleted: event.isDeleted, googleUpdatedAt: event.googleUpdatedAt } });
}
async function listUserSyncedEvents(userId, startAt, endAt) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const calendars = await listOwnedLinkedCalendars(userId);
  const visibleCalendarIds = calendars.filter((calendar) => calendar.isVisible).map((calendar) => calendar.id);
  if (!visibleCalendarIds.length) return [];
  return db.select().from(syncedEvents).where(and(
    inArray(syncedEvents.linkedCalendarId, visibleCalendarIds),
    gte(syncedEvents.endAt, startAt),
    lte(syncedEvents.startAt, endAt),
    eq(syncedEvents.isDeleted, false)
  ));
}
async function getOwnedLinkedCalendar(userId, linkedCalendarId) {
  const calendars = await listOwnedLinkedCalendars(userId);
  return calendars.find((calendar) => calendar.id === linkedCalendarId);
}
async function getUserSyncedEvent(userId, eventId2) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const calendars = await listOwnedLinkedCalendars(userId);
  const ownedCalendarIds = calendars.map((calendar2) => calendar2.id);
  if (!ownedCalendarIds.length) return void 0;
  const event = (await db.select().from(syncedEvents).where(and(eq(syncedEvents.id, eventId2), inArray(syncedEvents.linkedCalendarId, ownedCalendarIds))).limit(1))[0];
  if (!event) return void 0;
  const calendar = calendars.find((candidate) => candidate.id === event.linkedCalendarId);
  return calendar ? { event, calendar } : void 0;
}
async function setCalendarSyncState(linkedCalendarId, input) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(calendarSyncStates).values({ linkedCalendarId, ...input }).onDuplicateKeyUpdate({ set: input });
}
async function getWatchChannel(channelId, verificationToken) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return (await db.select().from(calendarWatchChannels).where(and(eq(calendarWatchChannels.channelId, channelId), eq(calendarWatchChannels.verificationToken, verificationToken))).limit(1))[0];
}
async function getLinkedCalendarById(linkedCalendarId) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return (await db.select().from(linkedCalendars).where(eq(linkedCalendars.id, linkedCalendarId)).limit(1))[0];
}
async function getCalendarConnectionById(connectionId) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return (await db.select().from(calendarConnections).where(eq(calendarConnections.id, connectionId)).limit(1))[0];
}
async function updateConnectionAccessToken(connectionId, encryptedAccessToken, accessTokenExpiresAt) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(calendarConnections).set({ encryptedAccessToken, accessTokenExpiresAt, status: "connected" }).where(eq(calendarConnections.id, connectionId));
}
async function getSyncState(linkedCalendarId) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return (await db.select().from(calendarSyncStates).where(eq(calendarSyncStates.linkedCalendarId, linkedCalendarId)).limit(1))[0];
}
async function replaceSparkAccessToken(userId, tokenHash) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(sparkAccessTokens).where(eq(sparkAccessTokens.userId, userId));
  await db.insert(sparkAccessTokens).values({ userId, tokenHash });
}
async function getSparkTokenOwner(tokenHash) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const token = (await db.select().from(sparkAccessTokens).where(eq(sparkAccessTokens.tokenHash, tokenHash)).limit(1))[0];
  if (!token) return void 0;
  await db.update(sparkAccessTokens).set({ lastUsedAt: /* @__PURE__ */ new Date() }).where(eq(sparkAccessTokens.id, token.id));
  return token.userId;
}
async function listSparkEvents(userId, startAt, endAt) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.select().from(sparkEvents).where(and(eq(sparkEvents.userId, userId), gte(sparkEvents.endAt, startAt), lte(sparkEvents.startAt, endAt)));
}
async function createSparkEvent(userId, input) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const created = await db.insert(sparkEvents).values({ userId, ...input });
  return (await db.select().from(sparkEvents).where(and(eq(sparkEvents.userId, userId), eq(sparkEvents.id, Number(created[0].insertId)))).limit(1))[0];
}
async function updateSparkEvent(userId, eventId2, input) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(sparkEvents).set(input).where(and(eq(sparkEvents.userId, userId), eq(sparkEvents.id, eventId2)));
  return (await db.select().from(sparkEvents).where(and(eq(sparkEvents.userId, userId), eq(sparkEvents.id, eventId2))).limit(1))[0];
}
async function deleteSparkEvent(userId, eventId2) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(sparkEvents).where(and(eq(sparkEvents.userId, userId), eq(sparkEvents.id, eventId2)));
}
async function upsertWatchChannel(input) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(calendarWatchChannels).values(input).onDuplicateKeyUpdate({ set: { resourceId: input.resourceId, verificationToken: input.verificationToken, expiresAt: input.expiresAt } });
}
async function listExpiringWatchChannels(before) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const rows = await db.select().from(calendarWatchChannels);
  return rows.filter((channel) => channel.expiresAt <= before);
}
var defaultPushReminderPreferences = {
  enabled: false,
  defaultLeadMinutes: 10,
  quietHoursStart: null,
  quietHoursEnd: null,
  timeZone: null
};
async function getPushReminderPreferences(userId) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const record = (await db.select().from(pushReminderPreferences).where(eq(pushReminderPreferences.userId, userId)).limit(1))[0];
  return record ?? { id: null, userId, ...defaultPushReminderPreferences };
}
async function upsertPushReminderPreferences(userId, input) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(pushReminderPreferences).values({ userId, ...input }).onDuplicateKeyUpdate({ set: input });
  return getPushReminderPreferences(userId);
}
async function upsertPushSubscription(input) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(pushSubscriptions).values({ ...input, status: "active", lastError: null }).onDuplicateKeyUpdate({
    set: { userId: input.userId, encryptedSubscription: input.encryptedSubscription, userAgent: input.userAgent, expiresAt: input.expiresAt, status: "active", lastError: null }
  });
  return (await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpointHash, input.endpointHash)).limit(1))[0];
}
async function listOwnedPushSubscriptions(userId) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.select({ id: pushSubscriptions.id, status: pushSubscriptions.status, userAgent: pushSubscriptions.userAgent, expiresAt: pushSubscriptions.expiresAt, createdAt: pushSubscriptions.createdAt, updatedAt: pushSubscriptions.updatedAt }).from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
}
async function getOwnedPushSubscriptionStatus(userId, endpointHash) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const subscription = (await db.select({ status: pushSubscriptions.status, expiresAt: pushSubscriptions.expiresAt }).from(pushSubscriptions).where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpointHash, endpointHash))).limit(1))[0];
  const connected = Boolean(subscription?.status === "active" && (!subscription.expiresAt || subscription.expiresAt > /* @__PURE__ */ new Date()));
  return { connected };
}
async function listActivePushSubscriptions(userId) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.select().from(pushSubscriptions).where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.status, "active")));
}
async function revokeOwnedPushSubscription(userId, subscriptionId) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(pushSubscriptions).set({ status: "revoked", encryptedSubscription: "", lastError: null }).where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.id, subscriptionId)));
}
async function revokeAllOwnedPushSubscriptions(userId) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(pushSubscriptions).set({ status: "revoked", encryptedSubscription: "", lastError: null }).where(eq(pushSubscriptions.userId, userId));
}
async function upsertPushReminderDelivery(input) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(pushReminderDeliveries).values({ ...input }).onDuplicateKeyUpdate({
    set: { sourceKind: input.sourceKind, sourceId: input.sourceId, title: input.title, body: input.body, targetSection: input.targetSection, scheduledAt: input.scheduledAt, state: "pending", claimToken: null, claimedAt: null, sentAt: null }
  });
}
async function cancelOwnedPushReminderDeliveries(userId, deliveryKeys) {
  const db = await getDb();
  if (!db || !deliveryKeys.length) return;
  await db.update(pushReminderDeliveries).set({ state: "cancelled" }).where(and(eq(pushReminderDeliveries.userId, userId), inArray(pushReminderDeliveries.deliveryKey, deliveryKeys)));
}
async function syncOwnedPersonalReminderItems(userId, items) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const existing = await db.select().from(personalReminderItems).where(and(eq(personalReminderItems.userId, userId), eq(personalReminderItems.isActive, true)));
  const existingBySource = new Map(existing.map((item) => [`${item.sourceKind}:${item.sourceId}`, item]));
  const incomingSources = new Set(items.map((item) => `${item.sourceKind}:${item.sourceId}`));
  const stale = existing.filter((item) => !incomingSources.has(`${item.sourceKind}:${item.sourceId}`));
  const itemsToSchedule = items.filter((item) => {
    const current = existingBySource.get(`${item.sourceKind}:${item.sourceId}`);
    return !current || current.deliveryKey !== item.deliveryKey || current.title !== item.title || current.body !== item.body || current.targetSection !== item.targetSection || current.occursAt.getTime() !== item.occursAt.getTime() || current.leadMinutes !== item.leadMinutes;
  });
  for (const item of items) {
    const { scheduledAt: _scheduledAt, ...record } = item;
    await db.insert(personalReminderItems).values({ userId, ...record, isActive: true }).onDuplicateKeyUpdate({
      set: { title: item.title, body: item.body, targetSection: item.targetSection, occursAt: item.occursAt, leadMinutes: item.leadMinutes ?? null, deliveryKey: item.deliveryKey, isActive: true }
    });
  }
  if (stale.length) {
    await db.update(personalReminderItems).set({ isActive: false }).where(and(eq(personalReminderItems.userId, userId), inArray(personalReminderItems.id, stale.map((item) => item.id))));
  }
  return {
    activeCount: items.length,
    itemsToSchedule,
    deliveryKeysToCancel: [...stale.map((item) => item.deliveryKey), ...itemsToSchedule.flatMap((item) => {
      const current = existingBySource.get(`${item.sourceKind}:${item.sourceId}`);
      return current && current.deliveryKey !== item.deliveryKey ? [current.deliveryKey] : [];
    })]
  };
}
async function getOwnedPersonalReminderEnrollmentSummary(userId) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const items = await db.select({ id: personalReminderItems.id, updatedAt: personalReminderItems.updatedAt }).from(personalReminderItems).where(and(eq(personalReminderItems.userId, userId), eq(personalReminderItems.isActive, true)));
  return {
    activeCount: items.length,
    lastUpdatedAt: items.reduce((latest, item) => !latest || item.updatedAt > latest ? item.updatedAt : latest, null)
  };
}
async function clearOwnedPersonalReminderItems(userId) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const items = await db.select({ id: personalReminderItems.id, deliveryKey: personalReminderItems.deliveryKey }).from(personalReminderItems).where(and(eq(personalReminderItems.userId, userId), eq(personalReminderItems.isActive, true)));
  if (items.length) {
    await db.update(personalReminderItems).set({ isActive: false }).where(and(eq(personalReminderItems.userId, userId), inArray(personalReminderItems.id, items.map((item) => item.id))));
  }
  return items.map((item) => item.deliveryKey);
}
async function requeueStalePushReminderDeliveryClaims(staleBefore) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(pushReminderDeliveries).set({ state: "pending", claimToken: null, claimedAt: null }).where(and(eq(pushReminderDeliveries.state, "claimed"), lt(pushReminderDeliveries.claimedAt, staleBefore)));
}
async function skipExpiredPendingPushReminderDeliveries(expiredBefore) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(pushReminderDeliveries).set({ state: "skipped", claimToken: null, claimedAt: null }).where(and(eq(pushReminderDeliveries.state, "pending"), lt(pushReminderDeliveries.scheduledAt, expiredBefore)));
}
async function claimDuePushReminderDeliveries(now, limit, claimToken) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const due = await db.select().from(pushReminderDeliveries).where(and(eq(pushReminderDeliveries.state, "pending"), lte(pushReminderDeliveries.scheduledAt, now))).orderBy(asc(pushReminderDeliveries.scheduledAt)).limit(limit);
  const claimed = [];
  for (const delivery of due) {
    await db.update(pushReminderDeliveries).set({
      state: "claimed",
      claimToken,
      claimedAt: now,
      attemptCount: delivery.attemptCount + 1
    }).where(and(eq(pushReminderDeliveries.id, delivery.id), eq(pushReminderDeliveries.state, "pending")));
    const current = (await db.select().from(pushReminderDeliveries).where(and(
      eq(pushReminderDeliveries.id, delivery.id),
      eq(pushReminderDeliveries.state, "claimed"),
      eq(pushReminderDeliveries.claimToken, claimToken)
    )).limit(1))[0];
    if (current) claimed.push(current);
  }
  return claimed;
}
async function markPushReminderDeliverySent(deliveryId, claimToken, sentAt) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(pushReminderDeliveries).set({ state: "sent", sentAt, claimToken: null, claimedAt: null }).where(and(eq(pushReminderDeliveries.id, deliveryId), eq(pushReminderDeliveries.state, "claimed"), eq(pushReminderDeliveries.claimToken, claimToken)));
}
async function deferClaimedPushReminderDelivery(deliveryId, claimToken, scheduledAt) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(pushReminderDeliveries).set({ state: "pending", scheduledAt, claimToken: null, claimedAt: null }).where(and(eq(pushReminderDeliveries.id, deliveryId), eq(pushReminderDeliveries.state, "claimed"), eq(pushReminderDeliveries.claimToken, claimToken)));
}
async function skipClaimedPushReminderDelivery(deliveryId, claimToken) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(pushReminderDeliveries).set({ state: "skipped", claimToken: null, claimedAt: null }).where(and(eq(pushReminderDeliveries.id, deliveryId), eq(pushReminderDeliveries.state, "claimed"), eq(pushReminderDeliveries.claimToken, claimToken)));
}
async function expirePushSubscription(subscriptionId, reason) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(pushSubscriptions).set({ status: "expired", encryptedSubscription: "", lastError: reason.slice(0, 255) }).where(and(eq(pushSubscriptions.id, subscriptionId), eq(pushSubscriptions.status, "active")));
}

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: isSecureRequest(req)
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { SignJWT, jwtVerify } from "jose";

// server/authSession.ts
import { createHash } from "node:crypto";
import { parse as parseCookieHeader } from "cookie";
function hashApplicationSession(token) {
  return createHash("sha256").update(token).digest("hex");
}
function sessionTokenFromRequest(req) {
  const cookieToken = parseCookieHeader(req.headers.cookie ?? "")[COOKIE_NAME];
  if (cookieToken) return cookieToken;
  const authorization = req.headers.authorization;
  return typeof authorization === "string" && authorization.startsWith("Bearer ") ? authorization.slice(7).trim() || void 0 : void 0;
}

// server/_core/sdk.ts
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    if (!ENV.isProduction) {
      console.log("[OAuth] Initialized");
      if (!ENV.oAuthServerUrl) console.error("[OAuth] OAUTH_SERVER_URL is not configured");
    }
  }
  decodeState(state) {
    return decodeOAuthState(state).redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? SESSION_TTL_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      if (!ENV.isProduction) console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        if (!ENV.isProduction) console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch {
      if (!ENV.isProduction) console.warn("[Auth] Session verification failed");
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const sessionToken = sessionTokenFromRequest(req);
    const session = await this.verifySession(sessionToken);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
      const taskUid = userInfo.taskUid ?? null;
      if (!taskUid) {
        throw ForbiddenError("Cron session missing task_uid");
      }
      return buildCronUser(userInfo);
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (sessionUserId.startsWith("google:")) {
      if (!user) throw ForbiddenError("Google session user not found");
    } else if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch {
        if (!ENV.isProduction) console.error("[Auth] Failed to sync user from OAuth");
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    if (!sessionToken || !await hasActiveApplicationSession(user.id, hashApplicationSession(sessionToken))) {
      throw ForbiddenError("Session is no longer active");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var CRON_OPEN_ID_PREFIX = "cron_";
function buildCronUser(userInfo) {
  const now = /* @__PURE__ */ new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Manus Scheduled Task",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? void 0,
    isCron: true
  };
}
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    const { nonce } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader2(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "lax" });
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: SESSION_TTL_MS
      });
      const user = await getUserByOpenId(userInfo.openId);
      if (!user) throw new Error("Session user was not created");
      await createApplicationSession({ userId: user.id, tokenHash: hashApplicationSession(sessionToken), expiresAt: new Date(Date.now() + SESSION_TTL_MS) });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: SESSION_TTL_MS });
      res.redirect(302, "/");
    } catch {
      if (!ENV.isProduction) console.error("[OAuth] Callback failed");
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/storageProxy.ts
function registerStorageProxy(app) {
  app.get(/^\/manus-storage\/(.+)$/, async (req, res) => {
    const key = req.params[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }
    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/"
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` }
      });
      if (!forgeResp.ok) {
        if (!ENV.isProduction) console.error(`[StorageProxy] upstream error (${forgeResp.status})`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = await forgeResp.json();
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch {
      if (!ENV.isProduction) console.error("[StorageProxy] failed");
      res.status(502).send("Storage proxy error");
    }
  });
}

// server/googleOAuth.ts
import { createCipheriv, createDecipheriv, createHash as createHash2, randomBytes, randomUUID } from "crypto";
var GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
var CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
var CALENDAR_LIST_SCOPE = "https://www.googleapis.com/auth/calendar.calendarlist.readonly";
var IDENTITY_SCOPES = ["openid", "email", "profile"];
function getGoogleOAuthConfig() {
  return {
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI
  };
}
function isGoogleOAuthConfigured(config = getGoogleOAuthConfig()) {
  return Boolean(config.clientId && config.clientSecret && config.redirectUri);
}
function googleOAuthReadiness(config = getGoogleOAuthConfig()) {
  const ready = isGoogleOAuthConfigured(config);
  return {
    ready,
    mode: ready ? "live" : "setup-pending",
    message: ready ? "Google Calendar is ready to connect after MY PLAN sign-in." : "Google Calendar setup is pending the owner\u2019s OAuth credentials. Calendar API and OAuth are the only required Google services; you can keep planning locally in MY PLAN."
  };
}
function buildGoogleAuthorizationUrl(config, state) {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", [...IDENTITY_SCOPES, CALENDAR_SCOPE, CALENDAR_LIST_SCOPE].join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}
function createConnectionState(userId) {
  return `${userId ?? "public"}.${randomUUID()}`;
}
function hashOAuthState(state) {
  return createHash2("sha256").update(state).digest("hex");
}
function encryptGoogleCredential(value, keyMaterial = process.env.JWT_SECRET) {
  if (!keyMaterial) throw new Error("JWT_SECRET is required to protect Google credentials");
  const key = createHash2("sha256").update(keyMaterial).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}
function decryptGoogleCredential(payload, keyMaterial = process.env.JWT_SECRET) {
  if (!keyMaterial) throw new Error("JWT_SECRET is required to protect Google credentials");
  const [ivValue, tagValue, encryptedValue] = payload.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Invalid encrypted credential payload");
  const key = createHash2("sha256").update(keyMaterial).digest();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8");
}
async function exchangeGoogleAuthorizationCode(config, code) {
  const body = new URLSearchParams({ code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri, grant_type: "authorization_code" });
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!response.ok) throw new Error(`Google token exchange failed with ${response.status}`);
  return response.json();
}
async function getGoogleProfile(accessToken) {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(`Google profile request failed with ${response.status}`);
  return response.json();
}
var googleActivationChecklist = [
  "Create a Google Cloud project owned by the app owner.",
  "Enable the Google Calendar API.",
  "Use only Calendar API and OAuth for this setup; do not enable paid Google Cloud products.",
  "Configure the OAuth consent screen and add test users while the app is in testing.",
  "Create a Web application OAuth client and add the application callback URL.",
  "Set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and GOOGLE_OAUTH_REDIRECT_URI in the project settings."
];
function googleOAuthSetupPendingResponse() {
  return {
    code: "GOOGLE_OAUTH_NOT_CONFIGURED",
    message: "Google Calendar activation requires the app owner's Google OAuth credentials. No paid Google Cloud product is required for this Calendar-only setup.",
    checklist: googleActivationChecklist
  };
}

// server/calendarSync.ts
import { randomUUID as randomUUID2 } from "crypto";

// server/googleCalendarApi.ts
async function googleRequest(path3, accessToken, init = {}) {
  const response = await fetch(`https://www.googleapis.com/calendar/v3${path3}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...init.headers ?? {} }
  });
  if (!response.ok) throw new Error(`Google Calendar request failed with ${response.status}`);
  return response.json();
}
function mapGoogleEvent(event) {
  const isAllDay = Boolean(event.start?.date && !event.start?.dateTime);
  const startValue = event.start?.dateTime ?? (event.start?.date ? `${event.start.date}T00:00:00.000Z` : void 0);
  const endValue = event.end?.dateTime ?? (event.end?.date ? `${event.end.date}T00:00:00.000Z` : void 0);
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
    googleUpdatedAt: event.updated ? new Date(event.updated) : null
  };
}
async function listGoogleCalendars(accessToken) {
  const response = await googleRequest("/users/me/calendarList?minAccessRole=reader", accessToken);
  return response.items ?? [];
}
async function listGoogleEvents(accessToken, calendarId, syncToken) {
  const parameters = new URLSearchParams({ singleEvents: "true", maxResults: "2500" });
  if (syncToken) parameters.set("syncToken", syncToken);
  else parameters.set("showDeleted", "true");
  return googleRequest(`/calendars/${encodeURIComponent(calendarId)}/events?${parameters}`, accessToken);
}
async function createGoogleEvent(accessToken, calendarId, input) {
  const body = input.isAllDay ? { summary: input.title, description: input.description, start: { date: input.startAt.toISOString().slice(0, 10) }, end: { date: input.endAt.toISOString().slice(0, 10) } } : { summary: input.title, description: input.description, start: { dateTime: input.startAt.toISOString() }, end: { dateTime: input.endAt.toISOString() } };
  return googleRequest(`/calendars/${encodeURIComponent(calendarId)}/events`, accessToken, { method: "POST", body: JSON.stringify(body) });
}
async function updateGoogleEvent(accessToken, calendarId, eventId2, input) {
  const body = input.isAllDay ? { summary: input.title, description: input.description, start: { date: input.startAt.toISOString().slice(0, 10) }, end: { date: input.endAt.toISOString().slice(0, 10) } } : { summary: input.title, description: input.description, start: { dateTime: input.startAt.toISOString() }, end: { dateTime: input.endAt.toISOString() } };
  return googleRequest(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId2)}`, accessToken, { method: "PATCH", body: JSON.stringify(body) });
}
async function deleteGoogleEvent(accessToken, calendarId, eventId2) {
  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId2)}`, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok && response.status !== 410) throw new Error(`Google Calendar delete failed with ${response.status}`);
}
async function refreshGoogleAccessToken(config, refreshToken) {
  const body = new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" });
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!response.ok) throw new Error(`Google token refresh failed with ${response.status}`);
  return response.json();
}
async function watchGoogleCalendar(accessToken, calendarId, callbackUrl, channelId, verificationToken) {
  return googleRequest(`/calendars/${encodeURIComponent(calendarId)}/events/watch`, accessToken, {
    method: "POST",
    body: JSON.stringify({ id: channelId, type: "web_hook", address: callbackUrl, token: verificationToken })
  });
}

// server/calendarSync.ts
async function getConnectionAccessToken(connection) {
  if (!isGoogleOAuthConfigured()) throw new Error("GOOGLE_OAUTH_NOT_CONFIGURED");
  if (connection.encryptedAccessToken && connection.accessTokenExpiresAt && connection.accessTokenExpiresAt.getTime() > Date.now() + 6e4) {
    return decryptGoogleCredential(connection.encryptedAccessToken);
  }
  if (!connection.encryptedRefreshToken) throw new Error("GOOGLE_REAUTH_REQUIRED");
  const refreshed = await refreshGoogleAccessToken(getGoogleOAuthConfig(), decryptGoogleCredential(connection.encryptedRefreshToken));
  await updateConnectionAccessToken(connection.id, encryptGoogleCredential(refreshed.access_token), new Date(Date.now() + refreshed.expires_in * 1e3));
  return refreshed.access_token;
}
async function importGoogleCalendarConnection(userId, connectionId, callbackUrl) {
  const connection = await getOwnedCalendarConnection(userId, connectionId);
  if (!connection) throw new Error("CONNECTION_NOT_FOUND");
  const accessToken = await getConnectionAccessToken(connection);
  const calendars = await listGoogleCalendars(accessToken);
  const existingCalendars = await listOwnedLinkedCalendars(userId);
  const discovered = [];
  for (const calendar of calendars.filter((calendar2) => calendar2.id && calendar2.selected !== false)) {
    const existing = existingCalendars.find((item) => item.connectionId === connectionId && item.externalCalendarId === calendar.id);
    const record = await upsertLinkedCalendar({
      connectionId,
      externalCalendarId: calendar.id,
      summary: calendar.summary || "Untitled calendar",
      timeZone: calendar.timeZone ?? null,
      color: calendar.backgroundColor ?? null,
      accessRole: calendar.accessRole ?? null,
      isPrimary: Boolean(calendar.primary),
      isVisible: existing?.isVisible ?? false
    });
    if (!record) continue;
    discovered.push(record.id);
    if (record.isVisible) await syncSelectedGoogleCalendar(userId, record.id, callbackUrl);
  }
  return discovered;
}
async function setGoogleCalendarSelection(userId, linkedCalendarId, isVisible, callbackUrl) {
  const calendar = await setOwnedLinkedCalendarVisibility(userId, linkedCalendarId, isVisible);
  if (!calendar) throw new Error("CALENDAR_NOT_FOUND");
  if (!isVisible) return { ...calendar, syncStatus: "idle" };
  try {
    await syncSelectedGoogleCalendar(userId, linkedCalendarId, callbackUrl);
    return { ...calendar, syncStatus: "healthy" };
  } catch (error) {
    const lastError = error instanceof Error ? error.message : "Google sync needs attention";
    try {
      await setCalendarSyncState(linkedCalendarId, { syncStatus: "attention", lastError });
    } catch {
    }
    return { ...calendar, syncStatus: "attention" };
  }
}
async function syncSelectedGoogleCalendar(userId, linkedCalendarId, callbackUrl) {
  const calendar = await getOwnedLinkedCalendar(userId, linkedCalendarId);
  if (!calendar || !calendar.isVisible) throw new Error("CALENDAR_NOT_FOUND");
  const connection = await getOwnedCalendarConnection(userId, calendar.connectionId);
  if (!connection) throw new Error("CONNECTION_NOT_FOUND");
  await syncGoogleLinkedCalendar(connection, calendar.id);
  const accessToken = await getConnectionAccessToken(connection);
  const channelId = randomUUID2();
  const verificationToken = randomUUID2();
  const watch = await watchGoogleCalendar(accessToken, calendar.externalCalendarId, callbackUrl, channelId, verificationToken);
  await upsertWatchChannel({ linkedCalendarId: calendar.id, channelId, verificationToken, resourceId: watch.resourceId, expiresAt: new Date(Number(watch.expiration ?? Date.now() + 24 * 60 * 60 * 1e3)) });
}
async function syncGoogleLinkedCalendar(connection, linkedCalendarId) {
  const accessToken = await getConnectionAccessToken(connection);
  const calendars = await listOwnedLinkedCalendars(connection.userId);
  const calendar = calendars.find((item) => item.id === linkedCalendarId && item.connectionId === connection.id && item.isVisible);
  if (!calendar) throw new Error("CALENDAR_NOT_FOUND");
  await setCalendarSyncState(linkedCalendarId, { syncStatus: "syncing", lastError: null });
  try {
    const existing = await getSyncState(linkedCalendarId);
    const response = await listGoogleEvents(accessToken, calendar.externalCalendarId, existing?.nextSyncToken ?? void 0);
    for (const event of response.items ?? []) await upsertSyncedEvent(linkedCalendarId, mapGoogleEvent(event));
    await setCalendarSyncState(linkedCalendarId, { syncStatus: "healthy", nextSyncToken: response.nextSyncToken ?? existing?.nextSyncToken ?? null, lastError: null, lastSyncedAt: /* @__PURE__ */ new Date() });
  } catch (error) {
    await setCalendarSyncState(linkedCalendarId, { syncStatus: "attention", lastError: error instanceof Error ? error.message : "Unknown sync error" });
    throw error;
  }
}
async function getLiveCalendar(userId, linkedCalendarId) {
  const calendar = await getOwnedLinkedCalendar(userId, linkedCalendarId);
  if (!calendar) throw new Error("CALENDAR_NOT_FOUND");
  const connection = await getCalendarConnectionById(calendar.connectionId);
  if (!connection || connection.userId !== userId) throw new Error("CONNECTION_NOT_FOUND");
  return { calendar, connection };
}
async function createCalendarEvent(userId, linkedCalendarId, input) {
  const { calendar, connection } = await getLiveCalendar(userId, linkedCalendarId);
  const googleEvent = await createGoogleEvent(await getConnectionAccessToken(connection), calendar.externalCalendarId, input);
  const mapped = mapGoogleEvent(googleEvent);
  await upsertSyncedEvent(calendar.id, mapped);
  return mapped;
}
async function updateCalendarEvent(userId, eventId2, input) {
  const owned = await getUserSyncedEvent(userId, eventId2);
  if (!owned) throw new Error("EVENT_NOT_FOUND");
  const connection = await getCalendarConnectionById(owned.calendar.connectionId);
  if (!connection) throw new Error("CONNECTION_NOT_FOUND");
  const googleEvent = await updateGoogleEvent(await getConnectionAccessToken(connection), owned.calendar.externalCalendarId, owned.event.externalEventId, input);
  const mapped = mapGoogleEvent(googleEvent);
  await upsertSyncedEvent(owned.calendar.id, mapped);
  return mapped;
}
async function deleteCalendarEvent(userId, eventId2) {
  const owned = await getUserSyncedEvent(userId, eventId2);
  if (!owned) throw new Error("EVENT_NOT_FOUND");
  const connection = await getCalendarConnectionById(owned.calendar.connectionId);
  if (!connection) throw new Error("CONNECTION_NOT_FOUND");
  await deleteGoogleEvent(await getConnectionAccessToken(connection), owned.calendar.externalCalendarId, owned.event.externalEventId);
  await upsertSyncedEvent(owned.calendar.id, { ...owned.event, isDeleted: true });
}
async function renewExpiringGoogleWatchChannels(callbackUrl, before = new Date(Date.now() + 12 * 60 * 60 * 1e3)) {
  const expiring = await listExpiringWatchChannels(before);
  let renewed = 0;
  for (const channel of expiring) {
    const calendar = await getLinkedCalendarById(channel.linkedCalendarId);
    if (!calendar || !calendar.isVisible) continue;
    const connection = await getCalendarConnectionById(calendar.connectionId);
    if (!connection) continue;
    const accessToken = await getConnectionAccessToken(connection);
    const channelId = randomUUID2();
    const verificationToken = randomUUID2();
    const watch = await watchGoogleCalendar(accessToken, calendar.externalCalendarId, callbackUrl, channelId, verificationToken);
    await upsertWatchChannel({ linkedCalendarId: calendar.id, channelId, verificationToken, resourceId: watch.resourceId, expiresAt: new Date(Number(watch.expiration ?? Date.now() + 24 * 60 * 60 * 1e3)) });
    renewed += 1;
  }
  return { renewed, inspected: expiring.length };
}

// server/googleRoutes.ts
function activationResponse(res) {
  return res.status(503).json(googleOAuthSetupPendingResponse());
}
function registerGoogleCalendarRoutes(app) {
  app.get("/api/google/health", (_req, res) => {
    res.json(googleOAuthReadiness());
  });
  app.get("/api/google/connect", async (req, res) => {
    const config = getGoogleOAuthConfig();
    if (!isGoogleOAuthConfigured(config)) return activationResponse(res);
    const configured = config;
    try {
      const user = await sdk.authenticateRequest(req);
      const state = createConnectionState(user.id);
      await createGoogleOAuthState(user.id, hashOAuthState(state), new Date(Date.now() + 10 * 60 * 1e3));
      return res.redirect(buildGoogleAuthorizationUrl(configured, state));
    } catch {
      return res.status(401).json({ code: "AUTH_REQUIRED", message: "Sign in to MY PLAN before linking a Google account." });
    }
  });
  app.get("/api/google/sign-in", async (_req, res) => {
    const config = getGoogleOAuthConfig();
    if (!isGoogleOAuthConfigured(config)) return activationResponse(res);
    const state = createConnectionState();
    await createGoogleOAuthState(null, hashOAuthState(state), new Date(Date.now() + 10 * 60 * 1e3));
    return res.redirect(buildGoogleAuthorizationUrl(config, state));
  });
  app.get("/api/google/callback", async (req, res) => {
    const config = getGoogleOAuthConfig();
    if (!isGoogleOAuthConfigured(config)) return activationResponse(res);
    const configured = config;
    const code = typeof req.query.code === "string" ? req.query.code : void 0;
    const state = typeof req.query.state === "string" ? req.query.state : void 0;
    if (!code || !state) return res.status(400).json({ code: "INVALID_CALLBACK", message: "Google did not provide a code and state." });
    try {
      const oauthState = await consumeGoogleOAuthState(hashOAuthState(state));
      if (!oauthState) return res.status(400).json({ code: "INVALID_STATE", message: "The Google authorization state was invalid or expired." });
      const token = await exchangeGoogleAuthorizationCode(configured, code);
      const profile = await getGoogleProfile(token.access_token);
      if (!oauthState.userId) {
        const openId = `google:${profile.sub}`;
        await upsertUser({ openId, name: profile.name ?? null, email: profile.email, loginMethod: "google", lastSignedIn: /* @__PURE__ */ new Date() });
        const signedInUser = await getUserByOpenId(openId);
        if (!signedInUser) throw new Error("Google user account could not be created");
        const session = await sdk.createSessionToken(openId, { name: signedInUser.name ?? "Google user", expiresInMs: SESSION_TTL_MS });
        await createApplicationSession({ userId: signedInUser.id, tokenHash: hashApplicationSession(session), expiresAt: new Date(Date.now() + SESSION_TTL_MS) });
        res.cookie(COOKIE_NAME, session, { ...getSessionCookieOptions(req), maxAge: SESSION_TTL_MS });
        return res.redirect("/?google=signed-in");
      }
      const connection = await upsertGoogleCalendarConnection({
        userId: oauthState.userId,
        googleSubject: profile.sub,
        email: profile.email,
        accountType: profile.hd ? "workspace" : "google",
        scopes: token.scope ?? null,
        encryptedAccessToken: encryptGoogleCredential(token.access_token),
        encryptedRefreshToken: token.refresh_token ? encryptGoogleCredential(token.refresh_token) : null,
        accessTokenExpiresAt: new Date(Date.now() + token.expires_in * 1e3)
      });
      if (!connection) throw new Error("Google calendar connection could not be saved");
      const callbackUrl = new URL(configured.redirectUri).origin + "/api/google/webhooks/calendar";
      await importGoogleCalendarConnection(oauthState.userId, connection.id, callbackUrl);
      return res.redirect("/?google=connected");
    } catch {
      if (!ENV.isProduction) console.error("[Google OAuth] Callback failed");
      return res.redirect("/?google=error");
    }
  });
  app.post("/api/google/webhooks/calendar", async (req, res) => {
    const resourceState = req.header("x-goog-resource-state");
    const channelId = req.header("x-goog-channel-id");
    const verificationToken = req.header("x-goog-channel-token");
    if (!resourceState) return res.status(400).json({ error: "Missing Google resource state" });
    if (!channelId || !verificationToken) return res.status(401).json({ error: "Missing Google watch channel verification" });
    try {
      const channel = await getWatchChannel(channelId, verificationToken);
      if (!channel || channel.expiresAt < /* @__PURE__ */ new Date()) return res.status(401).json({ error: "Unknown or expired Google watch channel" });
      if (resourceState === "sync") return res.status(204).end();
      const calendar = await getLinkedCalendarById(channel.linkedCalendarId);
      if (!calendar) return res.status(204).end();
      const connection = await getCalendarConnectionById(calendar.connectionId);
      if (!connection) return res.status(204).end();
      await syncGoogleLinkedCalendar(connection, calendar.id);
      return res.status(204).end();
    } catch {
      if (!ENV.isProduction) console.error("[Google Calendar] Webhook sync failed");
      return res.status(500).json({ error: "Google calendar synchronization failed" });
    }
  });
  app.post("/api/scheduled/renew-calendar-watches", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
      const config = getGoogleOAuthConfig();
      if (!isGoogleOAuthConfigured(config)) return res.json({ ok: true, skipped: "google-oauth-not-configured" });
      const callbackUrl = new URL(config.redirectUri).origin + "/api/google/webhooks/calendar";
      const result2 = await renewExpiringGoogleWatchChannels(callbackUrl);
      return res.json({ ok: true, ...result2 });
    } catch {
      if (!ENV.isProduction) console.error("[Google Calendar] Watch renewal failed");
      return res.status(500).json({ error: "Calendar watch renewal failed.", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
    }
  });
}

// server/mcpRoutes.ts
import { createHash as createHash3 } from "node:crypto";
var tools = [
  { name: "list_events", description: "List private MY PLAN events only for the connected account.", inputSchema: { type: "object", properties: { startAt: { type: "string" }, endAt: { type: "string" } }, required: ["startAt", "endAt"] } },
  { name: "create_event", description: "Create a private MY PLAN event after confirming its date and time with the user.", inputSchema: { type: "object", properties: { title: { type: "string" }, startAt: { type: "string" }, endAt: { type: "string" }, description: { type: "string" } }, required: ["title", "startAt", "endAt"] } },
  { name: "update_event", description: "Update a private MY PLAN event belonging to the connected account.", inputSchema: { type: "object", properties: { eventId: { type: "number" }, title: { type: "string" }, startAt: { type: "string" }, endAt: { type: "string" }, description: { type: "string" } }, required: ["eventId", "title", "startAt", "endAt"] } },
  { name: "delete_event", description: "Delete a private MY PLAN event belonging to the connected account after explicit confirmation.", inputSchema: { type: "object", properties: { eventId: { type: "number" } }, required: ["eventId"] } }
];
function validDate(value, label) {
  const date = typeof value === "string" ? new Date(value) : /* @__PURE__ */ new Date(NaN);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} must be ISO-8601.`);
  return date;
}
function title(value) {
  if (typeof value !== "string" || !value.trim() || value.length > 1024) throw new Error("title must be 1\u20131024 characters.");
  return value.trim();
}
function eventId(value) {
  if (!Number.isInteger(value) || value < 1) throw new Error("eventId must be a positive integer.");
  return value;
}
function result(value) {
  return { content: [{ type: "text", text: JSON.stringify(value) }] };
}
function requestToken(request) {
  const match = (request.header("authorization") || "").match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}
async function handleMcpRequest(userId, request) {
  const id = request.id ?? null;
  if (request.method === "initialize") return { jsonrpc: "2.0", id, result: { protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "MY PLAN", version: "1.0.0" } } };
  if (request.method === "tools/list") return { jsonrpc: "2.0", id, result: { tools } };
  if (request.method?.startsWith("notifications/")) return null;
  if (request.method !== "tools/call") return { jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } };
  try {
    const name = request.params?.name;
    const input = request.params?.arguments ?? {};
    if (name === "list_events") return { jsonrpc: "2.0", id, result: result(await listSparkEvents(userId, validDate(input.startAt, "startAt"), validDate(input.endAt, "endAt"))) };
    if (name === "create_event" || name === "update_event") {
      const startAt = validDate(input.startAt, "startAt");
      const endAt = validDate(input.endAt, "endAt");
      if (endAt <= startAt) throw new Error("endAt must be after startAt.");
      const payload = { title: title(input.title), description: typeof input.description === "string" ? input.description.slice(0, 1e4) : null, startAt, endAt };
      const event = name === "create_event" ? await createSparkEvent(userId, payload) : await updateSparkEvent(userId, eventId(input.eventId), payload);
      if (!event) throw new Error("Event not found in this MY PLAN workspace.");
      return { jsonrpc: "2.0", id, result: result(event) };
    }
    if (name === "delete_event") {
      await deleteSparkEvent(userId, eventId(input.eventId));
      return { jsonrpc: "2.0", id, result: result({ success: true }) };
    }
    return { jsonrpc: "2.0", id, error: { code: -32601, message: "Unknown MY PLAN tool" } };
  } catch (error) {
    return { jsonrpc: "2.0", id, error: { code: -32602, message: error instanceof Error ? error.message : "Invalid tool input" } };
  }
}
function registerMcpRoutes(app) {
  app.post("/api/mcp", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const token = requestToken(req);
    if (!token) {
      res.setHeader("WWW-Authenticate", "Bearer");
      return res.status(401).json({ error: "MY PLAN Spark credential required" });
    }
    if (!req.is("application/json") || !req.body || typeof req.body !== "object" || Array.isArray(req.body)) return res.status(400).json({ error: "MCP requests must use a JSON object." });
    const userId = await getSparkTokenOwner(createHash3("sha256").update(token).digest("hex"));
    if (!userId) {
      res.setHeader("WWW-Authenticate", "Bearer");
      return res.status(401).json({ error: "Invalid MY PLAN Spark credential" });
    }
    const response = await handleMcpRequest(userId, req.body);
    return response === null ? res.status(202).end() : res.status(200).json(response);
  });
}

// server/pushRoutes.ts
import { randomUUID as randomUUID3 } from "node:crypto";

// server/push.ts
import { createHash as createHash4 } from "node:crypto";
import webpush from "web-push";
var allowedReminderLeadMinutes = [0, 10, 30, 60, 24 * 60];
function getPushConfig() {
  return {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
    subject: process.env.VAPID_SUBJECT
  };
}
function isPushConfigured(config = getPushConfig()) {
  return Boolean(config.publicKey && config.privateKey && config.subject && /^(mailto:|https:\/\/)/.test(config.subject));
}
function pushReadiness(config = getPushConfig()) {
  const ready = isPushConfigured(config);
  return {
    ready,
    mode: ready ? "live" : "setup-pending",
    publicKey: ready ? config.publicKey : null,
    message: ready ? "Device reminders are ready to enable on this browser." : "Device reminders are being prepared. You can still set your reminder preferences; delivery activates after the owner securely configures the MY PLAN notification keys."
  };
}
function isAllowedReminderLeadMinutes(value) {
  return allowedReminderLeadMinutes.includes(value);
}
function isValidQuietHour(value) {
  return value == null || /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
function normalizePushSubscription(input) {
  if (!/^https:\/\//.test(input.endpoint) || input.endpoint.length > 2e3) throw new Error("Invalid push endpoint");
  if (!/^[A-Za-z0-9_-]{16,}$/.test(input.keys.p256dh) || !/^[A-Za-z0-9_-]{16,}$/.test(input.keys.auth)) throw new Error("Invalid push subscription keys");
  if (input.expirationTime !== null && (!Number.isFinite(input.expirationTime) || input.expirationTime <= Date.now())) throw new Error("Invalid push subscription expiry");
  return input;
}
function hashPushEndpoint(endpoint) {
  return createHash4("sha256").update(endpoint).digest("hex");
}
function encryptPushSubscription(input) {
  return encryptGoogleCredential(JSON.stringify(input));
}
function decryptPushSubscription(input) {
  return normalizePushSubscription(JSON.parse(decryptGoogleCredential(input)));
}
function createDeliveryKey(userId, sourceKind, sourceId, scheduledAt) {
  return createHash4("sha256").update(`${userId}:${sourceKind}:${sourceId}:${scheduledAt.toISOString()}`).digest("hex");
}
function isWithinQuietHours(now, timeZone, start, end) {
  if (!timeZone || !start || !end || start === end) return false;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  const current = `${hour}:${minute}`;
  return start < end ? current >= start && current < end : current >= start || current < end;
}
function nextPushDeliveryAfterQuietHours(now, timeZone, start, end) {
  if (!timeZone || !isWithinQuietHours(now, timeZone, start, end) || !end) return now;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  const currentMinutes = hour * 60 + minute;
  const [endHour, endMinute] = end.split(":").map(Number);
  const endMinutes = endHour * 60 + endMinute;
  const minutesUntilEnd = (endMinutes - currentMinutes + 1440) % 1440 || 1440;
  return new Date(now.getTime() + minutesUntilEnd * 6e4);
}
function pushDeliveryStatusCode(error) {
  if (!error || typeof error !== "object" || !("statusCode" in error)) return null;
  const statusCode = error.statusCode;
  return typeof statusCode === "number" && Number.isInteger(statusCode) ? statusCode : null;
}
function isExpiredPushSubscriptionError(error) {
  const statusCode = pushDeliveryStatusCode(error);
  return statusCode === 404 || statusCode === 410;
}
async function sendPushNotification(subscription, payload, config = getPushConfig()) {
  if (!isPushConfigured(config)) throw new Error("Native web push is not configured");
  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  return webpush.sendNotification(subscription, JSON.stringify({ ...payload, icon: "/manus-storage/my-plan-note-mark_567e5611.jpg", badge: "/manus-storage/my-plan-note-mark_567e5611.jpg" }), { TTL: 60 * 60 });
}

// server/pushRoutes.ts
var DELIVERY_BATCH_SIZE = 25;
var STALE_CLAIM_MS = 5 * 6e4;
var MAX_DELIVERY_AGE_MS = 60 * 6e4;
var RETRY_DELAY_MS = 5 * 6e4;
var MAX_ATTEMPTS = 3;
async function dispatchDuePushReminders(now = /* @__PURE__ */ new Date()) {
  if (!isPushConfigured()) return { skipped: "vapid-not-configured", claimed: 0, sent: 0, deferred: 0, skippedDeliveries: 0, retried: 0 };
  await requeueStalePushReminderDeliveryClaims(new Date(now.getTime() - STALE_CLAIM_MS));
  await skipExpiredPendingPushReminderDeliveries(new Date(now.getTime() - MAX_DELIVERY_AGE_MS));
  const claimToken = randomUUID3();
  const deliveries = await claimDuePushReminderDeliveries(now, DELIVERY_BATCH_SIZE, claimToken);
  const result2 = { claimed: deliveries.length, sent: 0, deferred: 0, skippedDeliveries: 0, retried: 0 };
  for (const delivery of deliveries) {
    const preferences = await getPushReminderPreferences(delivery.userId);
    if (!preferences.enabled) {
      await skipClaimedPushReminderDelivery(delivery.id, claimToken);
      result2.skippedDeliveries++;
      continue;
    }
    if (isWithinQuietHours(now, preferences.timeZone, preferences.quietHoursStart, preferences.quietHoursEnd)) {
      await deferClaimedPushReminderDelivery(delivery.id, claimToken, nextPushDeliveryAfterQuietHours(now, preferences.timeZone, preferences.quietHoursStart, preferences.quietHoursEnd));
      result2.deferred++;
      continue;
    }
    const subscriptions = await listActivePushSubscriptions(delivery.userId);
    if (!subscriptions.length) {
      await skipClaimedPushReminderDelivery(delivery.id, claimToken);
      result2.skippedDeliveries++;
      continue;
    }
    let delivered = false;
    let usableSubscriptionCount = 0;
    for (const subscription of subscriptions) {
      if (subscription.expiresAt && subscription.expiresAt <= now) {
        await expirePushSubscription(subscription.id, "subscription-expired");
        continue;
      }
      usableSubscriptionCount++;
      try {
        await sendPushNotification(decryptPushSubscription(subscription.encryptedSubscription), {
          title: delivery.title,
          body: delivery.body,
          route: `/?section=${delivery.targetSection}&reminder=${encodeURIComponent(delivery.sourceId)}`,
          tag: `my-plan-${delivery.deliveryKey}`
        });
        delivered = true;
      } catch (error) {
        if (isExpiredPushSubscriptionError(error)) await expirePushSubscription(subscription.id, `push-${pushDeliveryStatusCode(error)}`);
        else if (error instanceof SyntaxError) await expirePushSubscription(subscription.id, "invalid-subscription");
      }
    }
    if (delivered) {
      await markPushReminderDeliverySent(delivery.id, claimToken, now);
      result2.sent++;
    } else if (!usableSubscriptionCount) {
      await skipClaimedPushReminderDelivery(delivery.id, claimToken);
      result2.skippedDeliveries++;
    } else if (delivery.attemptCount >= MAX_ATTEMPTS) {
      await skipClaimedPushReminderDelivery(delivery.id, claimToken);
      result2.skippedDeliveries++;
    } else {
      await deferClaimedPushReminderDelivery(delivery.id, claimToken, new Date(now.getTime() + RETRY_DELAY_MS));
      result2.retried++;
    }
  }
  return result2;
}
function registerPushRoutes(app) {
  app.post("/api/scheduled/dispatch-push-reminders", async (req, res) => {
    let taskUid;
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
      taskUid = user.taskUid;
      return res.json({ ok: true, ...await dispatchDuePushReminders() });
    } catch (error) {
      if (error && typeof error === "object" && "statusCode" in error && error.statusCode === 403) {
        return res.status(403).json({ error: "cron-only" });
      }
      if (!ENV.isProduction) console.error("[MY PLAN Push] Scheduled delivery failed");
      return res.status(500).json({
        error: "MY PLAN device reminder dispatch failed.",
        context: { taskUid: taskUid ?? null },
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
  });
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title2 = trimValue(input.title);
  const content = trimValue(input.content);
  if (title2.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title: title2, content };
};
async function notifyOwner(payload) {
  const { title: title2, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title: title2, content })
    });
    if (!response.ok) {
      if (!ENV.isProduction) console.warn(`[Notification] Failed to notify owner (${response.status})`);
      return false;
    }
    return true;
  } catch {
    if (!ENV.isProduction) console.warn("[Notification] Error calling notification service");
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers.ts
import { TRPCError as TRPCError3 } from "@trpc/server";
import { z as z3 } from "zod";

// server/scheduleImport.ts
import { randomUUID as randomUUID4 } from "crypto";
import mammoth from "mammoth";
import * as XLSX from "xlsx";

// server/_core/llm.ts
var ensureArray = (value) => Array.isArray(value) ? value : [value];
var normalizeContentPart = (part) => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }
  if (part.type === "text") {
    return part;
  }
  if (part.type === "image_url") {
    return part;
  }
  if (part.type === "file_url") {
    return part;
  }
  throw new Error("Unsupported message content part");
};
var normalizeMessage = (message) => {
  const { role, name, tool_call_id } = message;
  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content).map((part) => typeof part === "string" ? part : JSON.stringify(part)).join("\n");
    return {
      role,
      name,
      tool_call_id,
      content
    };
  }
  const contentParts = ensureArray(message.content).map(normalizeContentPart);
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text
    };
  }
  return {
    role,
    name,
    content: contentParts
  };
};
var normalizeToolChoice = (toolChoice, tools2) => {
  if (!toolChoice) return void 0;
  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }
  if (toolChoice === "required") {
    if (!tools2 || tools2.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }
    if (tools2.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }
    return {
      type: "function",
      function: { name: tools2[0].function.name }
    };
  }
  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name }
    };
  }
  return toolChoice;
};
var resolveApiUrl = () => ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0 ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions` : "https://forge.manus.im/v1/chat/completions";
var assertApiKey = () => {
  if (!ENV.forgeApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
};
var normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema
}) => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (explicitFormat.type === "json_schema" && !explicitFormat.json_schema?.schema) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }
  const schema = outputSchema || output_schema;
  if (!schema) return void 0;
  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }
  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...typeof schema.strict === "boolean" ? { strict: schema.strict } : {}
    }
  };
};
var RETRY_MAX_RETRIES = 4;
var RETRY_BASE_DELAY_MS = 500;
var RETRY_MAX_DELAY_MS = 3e4;
var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
var parseRetryAfter = (value) => {
  if (!value) return void 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1e3);
  const at = Date.parse(value);
  return Number.isNaN(at) ? void 0 : Math.max(0, at - Date.now());
};
var computeBackoffDelay = (attempt, retryAfterMs) => {
  const cap = Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS);
  const jittered = cap / 2 + Math.random() * (cap / 2);
  return Math.min(Math.max(jittered, retryAfterMs ?? 0), RETRY_MAX_DELAY_MS);
};
var fetchWithBackoff = async (url, init) => {
  let lastError;
  for (let attempt = 0; attempt <= RETRY_MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, init);
      if (response.ok || attempt === RETRY_MAX_RETRIES) {
        return response;
      }
      const retryAfterMs = parseRetryAfter(
        response.headers.get("retry-after")
      );
      try {
        await response.body?.cancel();
      } catch {
      }
      console.warn(
        `LLM request retry ${attempt + 1}/${RETRY_MAX_RETRIES} after status ${response.status}`
      );
      await sleep(computeBackoffDelay(attempt, retryAfterMs));
    } catch (error) {
      lastError = error;
      if (attempt === RETRY_MAX_RETRIES) throw error;
      console.warn(
        `LLM request retry ${attempt + 1}/${RETRY_MAX_RETRIES} after network error`
      );
      await sleep(computeBackoffDelay(attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("LLM request failed after exhausting retries");
};
async function invokeLLM(params) {
  assertApiKey();
  const {
    messages,
    tools: tools2,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
    model,
    thinking,
    reasoning,
    maxTokens,
    max_tokens,
    maxCompletionTokens,
    max_completion_tokens
  } = params;
  const payload = {
    messages: messages.map(normalizeMessage)
  };
  if (model) {
    payload.model = model;
  }
  if (tools2 && tools2.length > 0) {
    payload.tools = tools2;
  }
  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools2
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }
  const resolvedMaxCompletionTokens = max_completion_tokens ?? maxCompletionTokens;
  const resolvedMaxTokens = max_tokens ?? maxTokens;
  if (typeof resolvedMaxCompletionTokens === "number") {
    payload.max_completion_tokens = resolvedMaxCompletionTokens;
  } else if (typeof resolvedMaxTokens === "number") {
    payload.max_tokens = resolvedMaxTokens;
  }
  if (thinking) {
    payload.thinking = thinking;
  }
  if (reasoning) {
    payload.reasoning = reasoning;
  }
  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema
  });
  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }
  const response = await fetchWithBackoff(resolveApiUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.forgeApiKey}`
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} \u2013 ${errorText}`
    );
  }
  return await response.json();
}

// server/storage.ts
function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;
  if (!forgeUrl || !forgeKey) {
    throw new Error(
      "Storage config missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }
  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}
function normalizeKey(relKey) {
  return relKey.replace(/^\/+/, "");
}
function appendHashSuffix(relKey) {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}
async function storagePut(relKey, data, contentType = "application/octet-stream") {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = appendHashSuffix(normalizeKey(relKey));
  const presignUrl = new URL("v1/storage/presign/put", forgeUrl + "/");
  presignUrl.searchParams.set("path", key);
  const presignResp = await fetch(presignUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` }
  });
  if (!presignResp.ok) {
    const msg = await presignResp.text().catch(() => presignResp.statusText);
    throw new Error(`Storage presign failed (${presignResp.status}): ${msg}`);
  }
  const { url: s3Url } = await presignResp.json();
  if (!s3Url) throw new Error("Forge returned empty presign URL");
  const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data], { type: contentType });
  const uploadResp = await fetch(s3Url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob
  });
  if (!uploadResp.ok) {
    throw new Error(`Storage upload to S3 failed (${uploadResp.status})`);
  }
  return { key, url: `/manus-storage/${key}` };
}

// server/scheduleImport.ts
var MAX_FILE_BYTES = 10 * 1024 * 1024;
var candidateKinds = /* @__PURE__ */ new Set(["event", "task", "block"]);
var SCHEDULE_IMAGE_EXTRACTION_MODEL = "gpt-5-mini";
function scheduleImportFailureMessage(error) {
  const message = error instanceof Error ? error.message.trim() : "";
  if (/^Upload must be between 1 byte and 10 MB\.|^Supported uploads are |^The schedule scan returned an incomplete response\./.test(message)) return message;
  return "MY PLAN could not scan this file just now. Please retry once or upload a clearer image under 10 MB.";
}
function decodeBase64(value) {
  const normalized = value.includes(",") ? value.slice(value.indexOf(",") + 1) : value;
  const buffer = Buffer.from(normalized, "base64");
  if (!buffer.length || buffer.length > MAX_FILE_BYTES) throw new Error("Upload must be between 1 byte and 10 MB.");
  return buffer;
}
function cleanText(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : value == null ? "" : String(value).replace(/\s+/g, " ").trim();
}
function dateOnly(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${String(value.getFullYear()).padStart(4, "0")}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  if (typeof value === "number" && value > 1 && value < 1e5) {
    const parsedExcelDate = XLSX.SSF.parse_date_code(value);
    if (parsedExcelDate) return `${String(parsedExcelDate.y).padStart(4, "0")}-${String(parsedExcelDate.m).padStart(2, "0")}-${String(parsedExcelDate.d).padStart(2, "0")}`;
  }
  const text2 = cleanText(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text2)) return text2;
  if (/^\d{5}(?:\.\d+)?$/.test(text2)) {
    const parsedExcelDate = XLSX.SSF.parse_date_code(Number(text2));
    if (parsedExcelDate) return `${String(parsedExcelDate.y).padStart(4, "0")}-${String(parsedExcelDate.m).padStart(2, "0")}-${String(parsedExcelDate.d).padStart(2, "0")}`;
  }
  const parsed = new Date(text2);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}
function timeOnly(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  }
  if (typeof value === "number" && value >= 0 && value < 1) {
    const minutes = Math.round(value * 24 * 60) % (24 * 60);
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  }
  const text2 = cleanText(value);
  const match = text2.match(/(?:^|\s)(\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]))?(?:\s|$)/);
  if (!match) return "";
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (match[3]) {
    if (match[3].toLowerCase() === "pm" && hour < 12) hour += 12;
    if (match[3].toLowerCase() === "am" && hour === 12) hour = 0;
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
function csvRows(text2) {
  const workbook = XLSX.read(text2, { type: "string", raw: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return sheet ? XLSX.utils.sheet_to_json(sheet, { defval: "" }) : [];
}
function readColumn(row, expressions) {
  const entry = Object.entries(row).find(([key]) => expressions.some((expression) => expression.test(key.toLowerCase())));
  return entry ? entry[1] : "";
}
function rowCandidates(rows) {
  return rows.slice(0, 120).flatMap((row, index2) => {
    const title2 = cleanText(readColumn(row, [/title/, /event/, /task/, /subject/, /course/, /activity/, /description/])) || cleanText(Object.values(row).find((value) => cleanText(value)));
    const date = dateOnly(readColumn(row, [/date/, /day/, /due/, /start/])) || dateOnly(readColumn(row, [/deadline/]));
    if (!title2) return [];
    const typeValue = cleanText(readColumn(row, [/type/, /kind/])).toLowerCase();
    const kind = typeValue.includes("task") || typeValue.includes("deadline") ? "task" : typeValue.includes("block") || typeValue.includes("study") ? "block" : "event";
    const durationNumber = Number(cleanText(readColumn(row, [/duration/, /minutes/, /mins/]))) || 60;
    return [{
      id: `local-${index2}-${randomUUID4()}`,
      title: title2,
      kind,
      date,
      time: timeOnly(readColumn(row, [/time/, /start/])),
      durationMinutes: Math.max(15, Math.min(720, Math.round(durationNumber))),
      course: cleanText(readColumn(row, [/course/, /subject/, /class/, /list/])),
      notes: cleanText(readColumn(row, [/note/, /detail/, /description/])),
      weekdays: [],
      confidence: date ? 0.94 : 0.62
    }];
  });
}
function unfoldedLines(text2) {
  return text2.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
}
function icsDate(value) {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);
  if (!match) return { date: "", time: "" };
  return { date: `${match[1]}-${match[2]}-${match[3]}`, time: match[4] ? `${match[4]}:${match[5]}` : "" };
}
function icsCandidates(text2) {
  const output = [];
  let event = null;
  for (const line of unfoldedLines(text2)) {
    if (line === "BEGIN:VEVENT") {
      event = {};
      continue;
    }
    if (line === "END:VEVENT" && event) {
      const start = icsDate(event.DTSTART || "");
      const end = icsDate(event.DTEND || "");
      const startMinutes = start.time ? Number(start.time.slice(0, 2)) * 60 + Number(start.time.slice(3)) : 0;
      const endMinutes = end.time ? Number(end.time.slice(0, 2)) * 60 + Number(end.time.slice(3)) : 60;
      output.push({
        id: `ics-${randomUUID4()}`,
        title: event.SUMMARY || "Untitled calendar event",
        kind: "event",
        date: start.date,
        time: start.time,
        durationMinutes: Math.max(15, end.date === start.date ? endMinutes - startMinutes : 60),
        course: "",
        notes: event.DESCRIPTION || "",
        weekdays: [],
        confidence: start.date ? 0.99 : 0.65
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
async function workbookCandidates(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const rows = workbook.SheetNames.slice(0, 5).flatMap((name) => XLSX.utils.sheet_to_json(workbook.Sheets[name], { defval: "" }));
  return rowCandidates(rows);
}
var extractionSchema = {
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
          confidence: { type: "number" }
        },
        required: ["title", "kind", "date", "time", "durationMinutes", "course", "notes", "weekdays", "confidence"],
        additionalProperties: false
      }
    }
  },
  required: ["candidates"],
  additionalProperties: false
};
function normalizeCandidates(value) {
  const candidates = Array.isArray(value?.candidates) ? value.candidates : [];
  const normalized = candidates.slice(0, 120).flatMap((candidate, index2) => {
    if (!candidate || typeof candidate !== "object") return [];
    const record = candidate;
    const title2 = cleanText(record.title);
    if (!title2) return [];
    const kind = candidateKinds.has(cleanText(record.kind)) ? cleanText(record.kind) : "event";
    return [{
      id: `ai-${index2}-${randomUUID4()}`,
      title: title2,
      kind,
      date: dateOnly(record.date),
      time: timeOnly(record.time),
      durationMinutes: Math.max(15, Math.min(720, Math.round(Number(record.durationMinutes) || 60))),
      course: cleanText(record.course),
      notes: cleanText(record.notes),
      weekdays: Array.isArray(record.weekdays) ? record.weekdays.filter((day) => typeof day === "number" && Number.isInteger(day) && day >= 0 && day <= 6) : [],
      confidence: Math.max(0, Math.min(1, Number(record.confidence) || 0.5))
    }];
  });
  return deduplicateTimetableCandidates(normalized);
}
function deduplicateTimetableCandidates(candidates) {
  const perDayCandidates = candidates.flatMap((candidate) => {
    const weekdays = Array.from(new Set(candidate.weekdays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)));
    if (weekdays.length < 2) return [{ ...candidate, weekdays }];
    return weekdays.map((day) => ({ ...candidate, id: `${candidate.id}-weekday-${day}`, weekdays: [day] }));
  });
  const seen = /* @__PURE__ */ new Map();
  for (const candidate of perDayCandidates) {
    const weekday = candidate.weekdays.length === 1 ? candidate.weekdays[0] : null;
    const slot = weekday == null || !candidate.time ? "" : `${weekday}|${candidate.time}`;
    const key = slot || `unique|${candidate.id}`;
    const current = seen.get(key);
    if (!current) {
      seen.set(key, candidate);
      continue;
    }
    const score = (value) => (value.course && value.title.localeCompare(value.course, void 0, { sensitivity: "accent" }) === 0 ? 3 : 0) + (value.notes ? 1 : 0) + value.confidence;
    if (score(candidate) > score(current)) seen.set(key, candidate);
  }
  return Array.from(seen.values()).map((candidate) => candidate.weekdays.length ? { ...candidate, course: candidate.title } : candidate);
}
function parseModelCandidates(value) {
  const text2 = typeof value === "string" ? value.trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "") : '{"candidates":[]}';
  try {
    return JSON.parse(text2);
  } catch {
    const recovered = Array.from(text2.matchAll(/\{(?:[^{}"]|"(?:\\.|[^"\\])*")+\}/g)).flatMap((match) => {
      try {
        const parsed = JSON.parse(match[0]);
        return typeof parsed.title === "string" ? [parsed] : [];
      } catch {
        return [];
      }
    });
    if (recovered.length) return { candidates: recovered };
    throw new Error("The schedule scan returned an incomplete response. Please try the image again or upload a clearer copy.");
  }
}
async function modelCandidates(fileName, mimeType, buffer, extractedText) {
  const content = extractedText ? [{ type: "text", text: `File name: ${fileName}

Extracted content:
${extractedText.slice(0, 6e4)}` }] : mimeType.startsWith("image/") ? [{ type: "text", text: `Extract schedule candidates from this ${fileName}.` }, { type: "image_url", image_url: { url: `data:${mimeType};base64,${buffer.toString("base64")}`, detail: "high" } }] : [{ type: "text", text: `Extract schedule candidates from this ${fileName}.` }, { type: "file_url", file_url: { url: `data:${mimeType};base64,${buffer.toString("base64")}`, mime_type: "application/pdf" } }];
  const response = await invokeLLM({
    model: SCHEDULE_IMAGE_EXTRACTION_MODEL,
    max_tokens: 14e3,
    messages: [
      { role: "system", content: "You extract schedules cautiously. Return only events, tasks, or focus blocks explicitly supported by the file. For a weekly timetable grid, perform a complete visual inventory: inspect every day column and every time row in reading order, then emit exactly one candidate for every non-empty grid cell. Never summarize, sample, merge, or omit cells because a subject repeats. A single weekday plus start time identifies one grid cell; never return two different candidates for the same weekday/time slot. Set kind to block for weekly timetable cells. Set weekdays to the visible day number where Sunday=0 through Saturday=6. Copy the subject/course label exactly into BOTH title and course. Copy room, faculty, batch, section, code, or other cell details only into notes. Copy the associated row/column time header exactly as 24-hour HH:MM; do not borrow a time or course from an adjacent cell. Before responding, cross-check that each non-empty grid cell has one output and that title, course, weekday, and time agree within that same cell. Use YYYY-MM-DD only when a date is clear; otherwise leave date blank. If text, day, or time is illegible, leave only that field blank instead of guessing. Never invent dates, times, course names, weekdays, rooms, or recurrences. Confidence must be between 0 and 1." },
      { role: "user", content }
    ],
    response_format: { type: "json_schema", json_schema: { name: "schedule_candidates", strict: true, schema: extractionSchema } }
  });
  const responseText = response.choices[0]?.message?.content;
  return normalizeCandidates(parseModelCandidates(responseText));
}
async function extractUploadedSchedule(userId, input) {
  const buffer = decodeBase64(input.contentBase64);
  const mimeType = input.mimeType || "application/octet-stream";
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120) || "schedule-upload";
  const stored = await storagePut(`users/${userId}/schedule-imports/${Date.now()}-${randomUUID4()}-${safeName}`, buffer, mimeType);
  const lowerName = input.fileName.toLowerCase();
  let candidates;
  let extractionMode;
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
    const result2 = await mammoth.extractRawText({ buffer });
    candidates = await modelCandidates(input.fileName, mimeType, buffer, result2.value);
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

// server/routers.ts
import { createHash as createHash5, randomBytes as randomBytes2 } from "node:crypto";

// shared/assistantDraft.ts
import { z as z2 } from "zod";
var assistantKinds = ["task", "event", "block"];
function isAssistantDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}
var assistantCommandDraftSchema = z2.object({
  kind: z2.enum(assistantKinds),
  title: z2.string().trim().min(1).max(160),
  date: z2.string().refine(isAssistantDate, "Use a real YYYY-MM-DD date.").nullable(),
  time: z2.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a valid 24-hour time.").nullable(),
  durationMinutes: z2.number().int().min(15).max(720).nullable(),
  priority: z2.enum(["normal", "high"]),
  course: z2.string().trim().max(120).nullable(),
  notes: z2.string().trim().max(500).nullable(),
  reminderLeadMinutes: z2.union([z2.literal(5), z2.literal(10), z2.literal(15), z2.literal(30), z2.literal(60), z2.literal(1440)]).nullable(),
  needsClarification: z2.boolean(),
  clarification: z2.string().trim().max(240).nullable()
}).superRefine((draft, context) => {
  if (!draft.needsClarification && !draft.date) context.addIssue({ code: z2.ZodIssueCode.custom, path: ["date"], message: "A date is required before this draft can be reviewed." });
  if (!draft.needsClarification && draft.reminderLeadMinutes !== null && !draft.time) context.addIssue({ code: z2.ZodIssueCode.custom, path: ["time"], message: "An exact time is required for a lead-time reminder." });
  if (draft.needsClarification && !draft.clarification) context.addIssue({ code: z2.ZodIssueCode.custom, path: ["clarification"], message: "Explain what needs clarification." });
});
var assistantDraftInputSchema = z2.object({
  message: z2.string().trim().min(3).max(800),
  referenceDate: z2.string().refine(isAssistantDate, "Reference date must be a real YYYY-MM-DD value."),
  timeZone: z2.string().trim().min(1).max(120)
});

// server/assistant.ts
var assistantResponseSchema = {
  type: "json_schema",
  json_schema: {
    name: "my_plan_assistant_draft",
    strict: true,
    schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["task", "event", "block"] },
        title: { type: "string" },
        date: { type: ["string", "null"] },
        time: { type: ["string", "null"] },
        durationMinutes: { type: ["integer", "null"] },
        priority: { type: "string", enum: ["normal", "high"] },
        course: { type: ["string", "null"] },
        notes: { type: ["string", "null"] },
        reminderLeadMinutes: { type: ["integer", "null"] },
        needsClarification: { type: "boolean" },
        clarification: { type: ["string", "null"] }
      },
      required: ["kind", "title", "date", "time", "durationMinutes", "priority", "course", "notes", "reminderLeadMinutes", "needsClarification", "clarification"],
      additionalProperties: false
    }
  }
};
var nonCreationActionPattern = /\b(delete|remove|cancel|edit|update|change|modify|rename|reschedule|move|duplicate|complete|mark|clear|dismiss|archive|unschedule|sync|import|export|share|notify)\b/i;
var explicitCreationPattern = /\b(create|add|plan|schedule|set|remind|block)\b/i;
function nonCreationAssistantDraft(message) {
  if (!nonCreationActionPattern.test(message) || explicitCreationPattern.test(message)) return null;
  return {
    kind: "task",
    title: "A new plan is needed",
    date: null,
    time: null,
    durationMinutes: null,
    priority: "normal",
    course: null,
    notes: null,
    reminderLeadMinutes: null,
    needsClarification: true,
    clarification: "MY PLAN Assistant can prepare a new task, event, or focus block, but it cannot delete, edit, move, sync, import, export, or send anything. What new plan should I prepare?"
  };
}
function assistantSystemPrompt({ referenceDate, timeZone }) {
  return `You are MY PLAN Assistant. Convert one planning request into a draft only. Never claim an action was saved, sent, scheduled, synced, deleted, or completed. Return JSON only.

Today is ${referenceDate} in ${timeZone}. Resolve clear relative dates such as today, tomorrow, next Monday, and this Friday using that reference. Handle common small typos and planning slang, including evt/event, tmw/tmr/tomorrow, hw/homework, assgn/assignment, rev/revision, and rem/remind.

Select kind: task for a next action or deadline, event for a personal appointment, block for focused study/work time. Date is required to review a draft. Time is optional unless the user asks for a lead-time reminder. A reminder is optional and must use only 5, 10, 15, 30, 60, or 1440 minutes before. A lead-time reminder is never reviewable without an exact time: when a reminder is requested but the time is absent or unclear, set time to null, needsClarification to true, and ask exactly what time the user means (for example, \u201CFive minutes before what time?\u201D). Do not invent a time or make that draft reviewable. Default duration is 60 minutes only for events and blocks when a time is supplied; otherwise use null. Set high priority only if the user explicitly signals urgency.

Never invent a date, time, reminder, course, notes, or private data. If the requested date is absent or unclear, set date to null, needsClarification to true, and state the one short question needed. Do not ask for clarification when a date is clear. Use date YYYY-MM-DD and time HH:MM in 24-hour format.`;
}
async function draftAssistantCommand(rawInput) {
  const input = assistantDraftInputSchema.parse(rawInput);
  const nonCreationDraft = nonCreationAssistantDraft(input.message);
  if (nonCreationDraft) return nonCreationDraft;
  const response = await invokeLLM({
    model: "gpt-5-mini",
    maxCompletionTokens: 700,
    reasoning: { effort: "minimal" },
    messages: [
      { role: "system", content: assistantSystemPrompt(input) },
      { role: "user", content: input.message }
    ],
    response_format: assistantResponseSchema
  });
  const content = response.choices[0]?.message.content;
  if (typeof content !== "string" || !content) throw new Error("MY PLAN Assistant returned no draft.");
  return assistantCommandDraftSchema.parse(JSON.parse(content));
}

// server/routers.ts
var appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      const sessionToken = sessionTokenFromRequest(ctx.req);
      if (sessionToken) await revokeApplicationSession(hashApplicationSession(sessionToken));
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true
      };
    })
  }),
  admin: router({
    status: adminProcedure.query(({ ctx }) => ({
      isAdmin: true,
      name: ctx.user.name,
      email: ctx.user.email,
      role: ctx.user.role
    })),
    overview: adminProcedure.query(() => getAdminOverview()),
    users: adminProcedure.query(() => listAdminUserDirectory()),
    setRole: adminProcedure.input(z3.object({ userId: z3.number().int().positive(), role: z3.enum(["admin", "user"]) })).mutation(({ ctx, input }) => setManagedUserRole(ctx.user.id, input.userId, input.role))
  }),
  calendar: router({
    readiness: publicProcedure.query(() => ({
      ...googleOAuthReadiness(),
      googleOAuthReady: isGoogleOAuthConfigured(),
      activationChecklist: googleActivationChecklist,
      sparkMcpStatus: "prepared"
    })),
    connections: protectedProcedure.query(({ ctx }) => listUserCalendarConnections(ctx.user.id)),
    linkedCalendars: protectedProcedure.query(({ ctx }) => listOwnedLinkedCalendars(ctx.user.id)),
    setVisibility: protectedProcedure.input(z3.object({ linkedCalendarId: z3.number().int().positive(), isVisible: z3.boolean() })).mutation(async ({ ctx, input }) => {
      const config = getGoogleOAuthConfig();
      if (!isGoogleOAuthConfigured(config)) throw new TRPCError3({ code: "PRECONDITION_FAILED", message: "Google OAuth is not configured yet." });
      const callbackUrl = new URL(config.redirectUri).origin + "/api/google/webhooks/calendar";
      return setGoogleCalendarSelection(ctx.user.id, input.linkedCalendarId, input.isVisible, callbackUrl);
    }),
    events: protectedProcedure.input(z3.object({ startAt: z3.date(), endAt: z3.date() })).query(({ ctx, input }) => listUserSyncedEvents(ctx.user.id, input.startAt, input.endAt)),
    createEvent: protectedProcedure.input(z3.object({ linkedCalendarId: z3.number().int().positive(), title: z3.string().min(1).max(1024), description: z3.string().max(1e4).optional(), startAt: z3.date(), endAt: z3.date(), isAllDay: z3.boolean().optional() })).mutation(async ({ ctx, input }) => {
      if (!isGoogleOAuthConfigured()) throw new TRPCError3({ code: "PRECONDITION_FAILED", message: "Google OAuth is not configured yet." });
      return createCalendarEvent(ctx.user.id, input.linkedCalendarId, input);
    }),
    updateEvent: protectedProcedure.input(z3.object({ eventId: z3.number().int().positive(), title: z3.string().min(1).max(1024), description: z3.string().max(1e4).optional(), startAt: z3.date(), endAt: z3.date(), isAllDay: z3.boolean().optional() })).mutation(async ({ ctx, input }) => {
      if (!isGoogleOAuthConfigured()) throw new TRPCError3({ code: "PRECONDITION_FAILED", message: "Google OAuth is not configured yet." });
      return updateCalendarEvent(ctx.user.id, input.eventId, input);
    }),
    deleteEvent: protectedProcedure.input(z3.object({ eventId: z3.number().int().positive() })).mutation(async ({ ctx, input }) => {
      if (!isGoogleOAuthConfigured()) throw new TRPCError3({ code: "PRECONDITION_FAILED", message: "Google OAuth is not configured yet." });
      await deleteCalendarEvent(ctx.user.id, input.eventId);
      return { success: true };
    })
  }),
  spark: router({
    events: protectedProcedure.input(z3.object({ startAt: z3.date(), endAt: z3.date() })).query(({ ctx, input }) => listSparkEvents(ctx.user.id, input.startAt, input.endAt)),
    createAccessToken: protectedProcedure.mutation(async ({ ctx }) => {
      const token = `myplan_${randomBytes2(32).toString("base64url")}`;
      await replaceSparkAccessToken(ctx.user.id, createHash5("sha256").update(token).digest("hex"));
      return { token };
    })
  }),
  assistant: router({
    draft: publicProcedure.input(z3.object({
      message: z3.string().trim().min(3).max(800),
      referenceDate: z3.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      timeZone: z3.string().trim().min(1).max(120)
    })).mutation(async ({ input }) => {
      try {
        return await draftAssistantCommand(input);
      } catch {
        throw new TRPCError3({ code: "BAD_REQUEST", message: "MY PLAN Assistant could not prepare that draft. Try a clearer request with a date." });
      }
    })
  }),
  schedule: router({
    extract: protectedProcedure.input(z3.object({
      fileName: z3.string().min(1).max(180),
      mimeType: z3.string().min(1).max(160),
      contentBase64: z3.string().min(1).max(14e6)
    })).mutation(async ({ ctx, input }) => {
      try {
        return await extractUploadedSchedule(ctx.user.id, input);
      } catch (error) {
        throw new TRPCError3({ code: "BAD_REQUEST", message: scheduleImportFailureMessage(error) });
      }
    })
  }),
  push: router({
    readiness: publicProcedure.query(() => pushReadiness()),
    preferences: protectedProcedure.query(({ ctx }) => getPushReminderPreferences(ctx.user.id)),
    updatePreferences: protectedProcedure.input(z3.object({
      defaultLeadMinutes: z3.number().int(),
      quietHoursStart: z3.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
      quietHoursEnd: z3.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
      timeZone: z3.string().min(1).max(128).nullable()
    })).mutation(async ({ ctx, input }) => {
      if (!isAllowedReminderLeadMinutes(input.defaultLeadMinutes) || !isValidQuietHour(input.quietHoursStart) || !isValidQuietHour(input.quietHoursEnd)) {
        throw new TRPCError3({ code: "BAD_REQUEST", message: "Invalid reminder preferences." });
      }
      const existing = await getPushReminderPreferences(ctx.user.id);
      return upsertPushReminderPreferences(ctx.user.id, { ...input, enabled: existing.enabled });
    }),
    subscriptions: protectedProcedure.query(({ ctx }) => listOwnedPushSubscriptions(ctx.user.id)),
    currentDevice: protectedProcedure.input(z3.object({ endpoint: z3.string().url().max(2e3) })).query(({ ctx, input }) => getOwnedPushSubscriptionStatus(ctx.user.id, hashPushEndpoint(input.endpoint))),
    personalEnrollment: protectedProcedure.query(({ ctx }) => getOwnedPersonalReminderEnrollmentSummary(ctx.user.id)),
    subscribe: protectedProcedure.input(z3.object({
      endpoint: z3.string().url().max(2e3),
      expirationTime: z3.number().finite().positive().nullable(),
      keys: z3.object({ p256dh: z3.string().min(16).max(512), auth: z3.string().min(16).max(512) }),
      userAgent: z3.string().max(512).nullable()
    })).mutation(async ({ ctx, input }) => {
      if (!pushReadiness().ready) throw new TRPCError3({ code: "PRECONDITION_FAILED", message: "MY PLAN device reminders are not configured yet." });
      const subscription = normalizePushSubscription(input);
      await upsertPushSubscription({
        userId: ctx.user.id,
        endpointHash: hashPushEndpoint(subscription.endpoint),
        encryptedSubscription: encryptPushSubscription(subscription),
        userAgent: input.userAgent,
        expiresAt: subscription.expirationTime ? new Date(subscription.expirationTime) : null
      });
      const preferences = await getPushReminderPreferences(ctx.user.id);
      await upsertPushReminderPreferences(ctx.user.id, { ...preferences, enabled: true });
      return { enabled: true };
    }),
    unsubscribe: protectedProcedure.input(z3.object({ subscriptionId: z3.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await revokeOwnedPushSubscription(ctx.user.id, input.subscriptionId);
      return { success: true };
    }),
    disableAll: protectedProcedure.mutation(async ({ ctx }) => {
      await revokeAllOwnedPushSubscriptions(ctx.user.id);
      const preferences = await getPushReminderPreferences(ctx.user.id);
      await upsertPushReminderPreferences(ctx.user.id, { ...preferences, enabled: false });
      return { success: true };
    }),
    scheduleDelivery: protectedProcedure.input(z3.object({
      sourceKind: z3.enum(["task", "event", "block"]),
      sourceId: z3.string().min(1).max(255),
      title: z3.string().min(1).max(1024),
      body: z3.string().min(1).max(512),
      targetSection: z3.enum(["calendar", "todo"]),
      scheduledAt: z3.date()
    })).mutation(async ({ ctx, input }) => {
      if (input.scheduledAt <= /* @__PURE__ */ new Date()) throw new TRPCError3({ code: "BAD_REQUEST", message: "A device reminder must be scheduled in the future." });
      const preferences = await getPushReminderPreferences(ctx.user.id);
      const subscriptions = await listActivePushSubscriptions(ctx.user.id);
      if (!preferences.enabled || !subscriptions.some((subscription) => !subscription.expiresAt || subscription.expiresAt > /* @__PURE__ */ new Date())) {
        throw new TRPCError3({ code: "PRECONDITION_FAILED", message: "Enable MY PLAN device reminders on a current browser before adding an off-app reminder." });
      }
      await upsertPushReminderDelivery({ ...input, userId: ctx.user.id, deliveryKey: createDeliveryKey(ctx.user.id, input.sourceKind, input.sourceId, input.scheduledAt) });
      return { success: true };
    }),
    syncPersonalEnrollment: protectedProcedure.input(z3.object({
      items: z3.array(z3.object({
        sourceKind: z3.enum(["task", "event", "block"]),
        sourceId: z3.string().min(1).max(255),
        title: z3.string().min(1).max(1024),
        body: z3.string().min(1).max(512),
        targetSection: z3.enum(["calendar", "todo"]),
        occursAt: z3.date(),
        leadMinutes: z3.number().int().min(5).max(1440).optional()
      })).max(750)
    })).mutation(async ({ ctx, input }) => {
      const preferences = await getPushReminderPreferences(ctx.user.id);
      const subscriptions = await listActivePushSubscriptions(ctx.user.id);
      if (!preferences.enabled || !subscriptions.some((subscription) => !subscription.expiresAt || subscription.expiresAt > /* @__PURE__ */ new Date())) {
        throw new TRPCError3({ code: "PRECONDITION_FAILED", message: "Enable MY PLAN device reminders on a current browser before making local planning items available for off-app reminders." });
      }
      const now = /* @__PURE__ */ new Date();
      const items = input.items.flatMap((item) => {
        const scheduledAt = new Date(item.occursAt.getTime() - (item.leadMinutes ?? preferences.defaultLeadMinutes) * 6e4);
        if (scheduledAt <= now) return [];
        return [{ ...item, deliveryKey: createDeliveryKey(ctx.user.id, item.sourceKind, item.sourceId, scheduledAt), scheduledAt }];
      });
      const result2 = await syncOwnedPersonalReminderItems(ctx.user.id, items);
      await Promise.all(result2.itemsToSchedule.map((item) => upsertPushReminderDelivery({ ...item, userId: ctx.user.id })));
      await cancelOwnedPushReminderDeliveries(ctx.user.id, result2.deliveryKeysToCancel);
      return { activeCount: result2.activeCount, scheduledCount: result2.itemsToSchedule.length };
    }),
    clearPersonalEnrollment: protectedProcedure.mutation(async ({ ctx }) => {
      const deliveryKeys = await clearOwnedPersonalReminderItems(ctx.user.id);
      await cancelOwnedPushReminderDeliveries(ctx.user.id, deliveryKeys);
      return { success: true };
    }),
    cancelDeliveries: protectedProcedure.input(z3.object({ deliveryKeys: z3.array(z3.string().regex(/^[a-f0-9]{64}$/)).max(100) })).mutation(async ({ ctx, input }) => {
      await cancelOwnedPushReminderDeliveries(ctx.user.id, input.deliveryKeys);
      return { success: true };
    })
  })
  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/vite.ts
import express from "express";
import fs2 from "fs";
import { nanoid } from "nanoid";
import path2 from "path";
import { createServer as createViteServer } from "vite";

// vite.config.ts
import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";
var PROJECT_ROOT = import.meta.dirname;
var LOG_DIR = path.join(PROJECT_ROOT, ".manus-logs");
var MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024;
var TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6);
function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}
function trimLogFile(logPath, maxSize) {
  try {
    if (!fs.existsSync(logPath) || fs.statSync(logPath).size <= maxSize) {
      return;
    }
    const lines = fs.readFileSync(logPath, "utf-8").split("\n");
    const keptLines = [];
    let keptBytes = 0;
    const targetSize = TRIM_TARGET_BYTES;
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineBytes = Buffer.byteLength(`${lines[i]}
`, "utf-8");
      if (keptBytes + lineBytes > targetSize) break;
      keptLines.unshift(lines[i]);
      keptBytes += lineBytes;
    }
    fs.writeFileSync(logPath, keptLines.join("\n"), "utf-8");
  } catch {
  }
}
function writeToLogFile(source, entries) {
  if (entries.length === 0) return;
  ensureLogDir();
  const logPath = path.join(LOG_DIR, `${source}.log`);
  const lines = entries.map((entry) => {
    const ts = (/* @__PURE__ */ new Date()).toISOString();
    return `[${ts}] ${JSON.stringify(entry)}`;
  });
  fs.appendFileSync(logPath, `${lines.join("\n")}
`, "utf-8");
  trimLogFile(logPath, MAX_LOG_SIZE_BYTES);
}
function vitePluginManusDebugCollector() {
  return {
    name: "manus-debug-collector",
    transformIndexHtml(html) {
      if (process.env.NODE_ENV === "production") {
        return html;
      }
      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: {
              src: "/__manus__/debug-collector.js",
              defer: true
            },
            injectTo: "head"
          }
        ]
      };
    },
    configureServer(server) {
      server.middlewares.use("/__manus__/logs", (req, res, next) => {
        if (req.method !== "POST") {
          return next();
        }
        const handlePayload = (payload) => {
          if (payload.consoleLogs?.length > 0) {
            writeToLogFile("browserConsole", payload.consoleLogs);
          }
          if (payload.networkRequests?.length > 0) {
            writeToLogFile("networkRequests", payload.networkRequests);
          }
          if (payload.sessionEvents?.length > 0) {
            writeToLogFile("sessionReplay", payload.sessionEvents);
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        };
        const reqBody = req.body;
        if (reqBody && typeof reqBody === "object") {
          try {
            handlePayload(reqBody);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
          return;
        }
        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });
        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            handlePayload(payload);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      });
    }
  };
}
var plugins = [react(), tailwindcss(), jsxLocPlugin(), vitePluginManusRuntime(), vitePluginManusDebugCollector()];
var vite_config_default = defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("react-day-picker")) return "date-picker";
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("@trpc") || id.includes("@tanstack")) return "data-client";
          if (id.includes("react") || id.includes("scheduler")) return "react-vendor";
        }
      }
    }
  },
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1"
    ],
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/_core/vite.ts
async function setupVite(app, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    server: serverOptions,
    appType: "custom"
  });
  app.use(vite.middlewares);
  app.use(async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );
      let template = await fs2.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app) {
  const distPath = process.env.NODE_ENV === "development" ? path2.resolve(import.meta.dirname, "../..", "dist", "public") : path2.resolve(import.meta.dirname, "public");
  if (!fs2.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app.use(express.static(distPath));
  app.use((_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/security.ts
function header(request, name) {
  const value = request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}
function configuredPublicHost(redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI) {
  if (!redirectUri) return void 0;
  try {
    return new URL(redirectUri).host.toLowerCase();
  } catch {
    return void 0;
  }
}
function isSameOriginUnsafeRequest(request, redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method.toUpperCase())) return true;
  const origin = header(request, "origin");
  if (!origin) return true;
  const host = header(request, "x-forwarded-host")?.split(",")[0]?.trim() || header(request, "host");
  if (!host) return false;
  try {
    const originHost = new URL(origin).host.toLowerCase();
    return originHost === host.toLowerCase() || originHost === configuredPublicHost(redirectUri);
  } catch {
    return false;
  }
}
function securityHeaders(request, response, next) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  response.setHeader("Content-Security-Policy", "base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
  if (request.path.startsWith("/api/")) response.setHeader("Cache-Control", "no-store");
  const forwarded = header(request, "x-forwarded-proto");
  if (request.protocol === "https" || forwarded?.split(",").some((value) => value.trim() === "https")) {
    response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  if (!isSameOriginUnsafeRequest(request)) {
    response.status(403).json({ error: "Cross-origin write requests are not accepted." });
    return;
  }
  next();
}

// server/rateLimits.ts
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
var sensitiveRouteLimits = {
  oauthCallback: { windowMs: 15 * 6e4, max: 30 },
  mcp: { windowMs: 6e4, max: 120 },
  scheduleExtract: { windowMs: 15 * 6e4, max: 6 },
  assistantDraft: { windowMs: 5 * 6e4, max: 20 }
};
function limitMessage(res) {
  res.status(429).json({ error: "Too many requests. Please wait and try again." });
}
function keyForRequest(req) {
  return ipKeyGenerator(req.ip || req.socket.remoteAddress || "unknown");
}
function sensitiveRateLimit(policy) {
  return rateLimit({
    windowMs: policy.windowMs,
    limit: policy.max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: keyForRequest,
    handler: (_req, res) => limitMessage(res)
  });
}

// server/_core/app.ts
async function createApp(server) {
  const app = express2();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(securityHeaders);
  app.use(express2.json({ limit: "15mb" }));
  app.use(express2.urlencoded({ limit: "16kb", extended: false }));
  app.use("/api/oauth/callback", sensitiveRateLimit(sensitiveRouteLimits.oauthCallback));
  app.use("/api/mcp", sensitiveRateLimit(sensitiveRouteLimits.mcp));
  app.use("/api/trpc/schedule.extract", sensitiveRateLimit(sensitiveRouteLimits.scheduleExtract));
  app.use("/api/trpc/assistant.draft", sensitiveRateLimit(sensitiveRouteLimits.assistantDraft));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerGoogleCalendarRoutes(app);
  registerMcpRoutes(app);
  registerPushRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  if (process.env.NODE_ENV === "development") {
    if (!server) throw new Error("A local HTTP server is required in development mode");
    await setupVite(app, server);
  } else if (process.env.VERCEL !== "1") {
    serveStatic(app);
  }
  return app;
}
export {
  createApp
};
