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
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  stateHash: varchar("stateHash", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("googleOAuthStates_user_idx").on(table.userId)]);

export type CalendarConnection = typeof calendarConnections.$inferSelect;
export type LinkedCalendar = typeof linkedCalendars.$inferSelect;
export type SyncedEvent = typeof syncedEvents.$inferSelect;
