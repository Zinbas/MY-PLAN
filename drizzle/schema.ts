import { boolean, index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
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
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** Individually revocable hashes of browser session credentials. Raw JWTs never enter this table. */
export const applicationSessions = mysqlTable("applicationSessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  revokedAt: timestamp("revokedAt"),
  lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("applicationSessions_user_status_idx").on(table.userId, table.revokedAt, table.expiresAt)]);

/** One-time, verifier-bound native sign-in handoffs. Raw codes and verifiers are never persisted. */
export const nativeOAuthHandoffs = mysqlTable("nativeOAuthHandoffs", {
  id: int("id").autoincrement().primaryKey(),
  codeHash: varchar("codeHash", { length: 64 }).notNull().unique(),
  verifierHash: varchar("verifierHash", { length: 64 }).notNull(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expiresAt").notNull(),
  consumedAt: timestamp("consumedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("nativeOAuthHandoffs_user_expiry_idx").on(table.userId, table.expiresAt)]);

/** Google or Google Workspace identity linked by an application user. Tokens remain server-only. */
export const calendarConnections = mysqlTable("calendarConnections", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  uniqueIndex("calendarConnections_user_email_unique").on(table.userId, table.email),
  index("calendarConnections_user_idx").on(table.userId),
]);

/** A calendar selected by the user from one of their linked Google identities. */
export const linkedCalendars = mysqlTable("linkedCalendars", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  uniqueIndex("linkedCalendars_connection_external_unique").on(table.connectionId, table.externalCalendarId),
  index("linkedCalendars_connection_idx").on(table.connectionId),
]);

/** Local event mirror used for fast calendar rendering and incremental Google Calendar sync. */
export const syncedEvents = mysqlTable("syncedEvents", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  uniqueIndex("syncedEvents_calendar_external_unique").on(table.linkedCalendarId, table.externalEventId),
  index("syncedEvents_calendar_start_idx").on(table.linkedCalendarId, table.startAt),
]);

/** Cursor and health state for an incremental synchronization stream. */
export const calendarSyncStates = mysqlTable("calendarSyncStates", {
  id: int("id").autoincrement().primaryKey(),
  linkedCalendarId: int("linkedCalendarId").notNull().references(() => linkedCalendars.id, { onDelete: "cascade" }).unique(),
  nextSyncToken: text("nextSyncToken"),
  lastSyncedAt: timestamp("lastSyncedAt"),
  lastError: text("lastError"),
  syncStatus: mysqlEnum("syncStatus", ["idle", "syncing", "healthy", "attention"]).notNull().default("idle"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Google Calendar watch-channel metadata used to authenticate webhook notifications and renew subscriptions. */
export const calendarWatchChannels = mysqlTable("calendarWatchChannels", {
  id: int("id").autoincrement().primaryKey(),
  linkedCalendarId: int("linkedCalendarId").notNull().references(() => linkedCalendars.id, { onDelete: "cascade" }),
  channelId: varchar("channelId", { length: 128 }).notNull().unique(),
  resourceId: varchar("resourceId", { length: 512 }).notNull(),
  verificationToken: varchar("verificationToken", { length: 256 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("calendarWatchChannels_calendar_idx").on(table.linkedCalendarId)]);

/** Short-lived, one-time CSRF binding for a Google OAuth link attempt. */
export const googleOAuthStates = mysqlTable("googleOAuthStates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id, { onDelete: "cascade" }),
  stateHash: varchar("stateHash", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("googleOAuthStates_user_idx").on(table.userId)]);

/** A revocable, hashed credential used only by a user's connected Gemini Spark custom app. */
export const sparkAccessTokens = mysqlTable("sparkAccessTokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("tokenHash", { length: 128 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  lastUsedAt: timestamp("lastUsedAt"),
}, table => [uniqueIndex("sparkAccessTokens_user_unique").on(table.userId)]);

/** Server-persisted private MY PLAN events created through a user's Spark custom app. */
export const sparkEvents = mysqlTable("sparkEvents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 1024 }).notNull(),
  description: text("description"),
  startAt: timestamp("startAt").notNull(),
  endAt: timestamp("endAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("sparkEvents_user_start_idx").on(table.userId, table.startAt)]);

/** User-controlled rules for MY PLAN's native, opt-in off-app reminders. */
export const pushReminderPreferences = mysqlTable("pushReminderPreferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  enabled: boolean("enabled").notNull().default(false),
  defaultLeadMinutes: int("defaultLeadMinutes").notNull().default(10),
  quietHoursStart: varchar("quietHoursStart", { length: 5 }),
  quietHoursEnd: varchar("quietHoursEnd", { length: 5 }),
  timeZone: varchar("timeZone", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** A per-device push subscription. Endpoint and encryption keys are encrypted server-side. */
export const pushSubscriptions = mysqlTable("pushSubscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  endpointHash: varchar("endpointHash", { length: 128 }).notNull().unique(),
  encryptedSubscription: text("encryptedSubscription").notNull(),
  userAgent: varchar("userAgent", { length: 512 }),
  expiresAt: timestamp("expiresAt"),
  status: mysqlEnum("status", ["active", "revoked", "expired"]).notNull().default("active"),
  lastError: varchar("lastError", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("pushSubscriptions_user_status_idx").on(table.userId, table.status)]);

/** Native FCM device registrations, intentionally separate from encrypted browser Web Push subscriptions. */
export const nativePushSubscriptions = mysqlTable("nativePushSubscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
  encryptedToken: text("encryptedToken").notNull(),
  platform: mysqlEnum("platform", ["android"]).notNull().default("android"),
  deviceLabel: varchar("deviceLabel", { length: 128 }),
  status: mysqlEnum("status", ["active", "revoked", "expired"]).notNull().default("active"),
  lastError: varchar("lastError", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("nativePushSubscriptions_user_status_idx").on(table.userId, table.status)]);

/** Minimal, user-approved reminder payloads claimed and delivered by the background dispatcher. */
export const pushReminderDeliveries = mysqlTable("pushReminderDeliveries", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  index("pushReminderDeliveries_due_idx").on(table.state, table.scheduledAt),
  index("pushReminderDeliveries_user_idx").on(table.userId),
]);

/** Minimal, explicit copies of upcoming local planning items that a user has chosen to make available for device reminders. */
export const personalReminderItems = mysqlTable("personalReminderItems", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  uniqueIndex("personalReminderItems_user_source_unique").on(table.userId, table.sourceKind, table.sourceId),
  index("personalReminderItems_user_active_idx").on(table.userId, table.isActive, table.occursAt),
]);

export type CalendarConnection = typeof calendarConnections.$inferSelect;
export type ApplicationSession = typeof applicationSessions.$inferSelect;
export type NativeOAuthHandoff = typeof nativeOAuthHandoffs.$inferSelect;
export type LinkedCalendar = typeof linkedCalendars.$inferSelect;
export type SyncedEvent = typeof syncedEvents.$inferSelect;
export type SparkEvent = typeof sparkEvents.$inferSelect;
export type PushReminderPreference = typeof pushReminderPreferences.$inferSelect;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type NativePushSubscription = typeof nativePushSubscriptions.$inferSelect;
export type PushReminderDelivery = typeof pushReminderDeliveries.$inferSelect;
export type PersonalReminderItem = typeof personalReminderItems.$inferSelect;
