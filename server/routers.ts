import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { googleActivationChecklist, googleOAuthReadiness, isGoogleOAuthConfigured } from "./googleOAuth";
import { cancelOwnedPushReminderDeliveries, getAdminOverview, getPushReminderPreferences, listActivePushSubscriptions, listAdminUserDirectory, listOwnedLinkedCalendars, listOwnedPushSubscriptions, listUserCalendarConnections, listUserSyncedEvents, revokeAllOwnedPushSubscriptions, revokeOwnedPushSubscription, setManagedUserRole, upsertPushReminderDelivery, upsertPushReminderPreferences, upsertPushSubscription } from "./db";
import { createCalendarEvent, deleteCalendarEvent, setGoogleCalendarSelection, updateCalendarEvent } from "./calendarSync";
import { getGoogleOAuthConfig } from "./googleOAuth";
import { extractUploadedSchedule, scheduleImportFailureMessage } from "./scheduleImport";
import { createHash, randomBytes } from "node:crypto";
import { listSparkEvents, replaceSparkAccessToken } from "./db";
import { createDeliveryKey, encryptPushSubscription, hashPushEndpoint, isAllowedReminderLeadMinutes, isValidQuietHour, normalizePushSubscription, pushReadiness } from "./push";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  admin: router({
    status: adminProcedure.query(({ ctx }) => ({
      isAdmin: true as const,
      name: ctx.user.name,
      email: ctx.user.email,
      role: ctx.user.role,
    })),
    overview: adminProcedure.query(() => getAdminOverview()),
    users: adminProcedure.query(() => listAdminUserDirectory()),
    setRole: adminProcedure.input(z.object({ userId: z.number().int().positive(), role: z.enum(["admin", "user"]) })).mutation(({ ctx, input }) => setManagedUserRole(ctx.user.id, input.userId, input.role)),
  }),
  calendar: router({
    readiness: publicProcedure.query(() => ({
      ...googleOAuthReadiness(),
      googleOAuthReady: isGoogleOAuthConfigured(),
      activationChecklist: googleActivationChecklist,
      sparkMcpStatus: "prepared" as const,
    })),
    connections: protectedProcedure.query(({ ctx }) => listUserCalendarConnections(ctx.user.id)),
    linkedCalendars: protectedProcedure.query(({ ctx }) => listOwnedLinkedCalendars(ctx.user.id)),
    setVisibility: protectedProcedure.input(z.object({ linkedCalendarId: z.number().int().positive(), isVisible: z.boolean() })).mutation(async ({ ctx, input }) => {
      const config = getGoogleOAuthConfig();
      if (!isGoogleOAuthConfigured(config)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Google OAuth is not configured yet." });
      const callbackUrl = new URL((config as Required<typeof config>).redirectUri).origin + "/api/google/webhooks/calendar";
      return setGoogleCalendarSelection(ctx.user.id, input.linkedCalendarId, input.isVisible, callbackUrl);
    }),
    events: protectedProcedure.input(z.object({ startAt: z.date(), endAt: z.date() })).query(({ ctx, input }) => listUserSyncedEvents(ctx.user.id, input.startAt, input.endAt)),
    createEvent: protectedProcedure.input(z.object({ linkedCalendarId: z.number().int().positive(), title: z.string().min(1).max(1024), description: z.string().max(10_000).optional(), startAt: z.date(), endAt: z.date(), isAllDay: z.boolean().optional() })).mutation(async ({ ctx, input }) => {
      if (!isGoogleOAuthConfigured()) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Google OAuth is not configured yet." });
      return createCalendarEvent(ctx.user.id, input.linkedCalendarId, input);
    }),
    updateEvent: protectedProcedure.input(z.object({ eventId: z.number().int().positive(), title: z.string().min(1).max(1024), description: z.string().max(10_000).optional(), startAt: z.date(), endAt: z.date(), isAllDay: z.boolean().optional() })).mutation(async ({ ctx, input }) => {
      if (!isGoogleOAuthConfigured()) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Google OAuth is not configured yet." });
      return updateCalendarEvent(ctx.user.id, input.eventId, input);
    }),
    deleteEvent: protectedProcedure.input(z.object({ eventId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      if (!isGoogleOAuthConfigured()) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Google OAuth is not configured yet." });
      await deleteCalendarEvent(ctx.user.id, input.eventId);
      return { success: true } as const;
    }),
  }),
  spark: router({
    events: protectedProcedure.input(z.object({ startAt: z.date(), endAt: z.date() })).query(({ ctx, input }) => listSparkEvents(ctx.user.id, input.startAt, input.endAt)),
    createAccessToken: protectedProcedure.mutation(async ({ ctx }) => {
      const token = `myplan_${randomBytes(32).toString("base64url")}`;
      await replaceSparkAccessToken(ctx.user.id, createHash("sha256").update(token).digest("hex"));
      return { token };
    }),
  }),
  schedule: router({
    extract: protectedProcedure.input(z.object({
      fileName: z.string().min(1).max(180),
      mimeType: z.string().min(1).max(160),
      contentBase64: z.string().min(1).max(14_000_000),
    })).mutation(async ({ ctx, input }) => {
      try {
        return await extractUploadedSchedule(ctx.user.id, input);
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: scheduleImportFailureMessage(error) });
      }
    }),
  }),
  push: router({
    readiness: publicProcedure.query(() => pushReadiness()),
    preferences: protectedProcedure.query(({ ctx }) => getPushReminderPreferences(ctx.user.id)),
    updatePreferences: protectedProcedure.input(z.object({
      defaultLeadMinutes: z.number().int(),
      quietHoursStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
      quietHoursEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
      timeZone: z.string().min(1).max(128).nullable(),
    })).mutation(async ({ ctx, input }) => {
      if (!isAllowedReminderLeadMinutes(input.defaultLeadMinutes) || !isValidQuietHour(input.quietHoursStart) || !isValidQuietHour(input.quietHoursEnd)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid reminder preferences." });
      }
      const existing = await getPushReminderPreferences(ctx.user.id);
      return upsertPushReminderPreferences(ctx.user.id, { ...input, enabled: existing.enabled });
    }),
    subscriptions: protectedProcedure.query(({ ctx }) => listOwnedPushSubscriptions(ctx.user.id)),
    subscribe: protectedProcedure.input(z.object({
      endpoint: z.string().url().max(2_000),
      expirationTime: z.number().finite().positive().nullable(),
      keys: z.object({ p256dh: z.string().min(16).max(512), auth: z.string().min(16).max(512) }),
      userAgent: z.string().max(512).nullable(),
    })).mutation(async ({ ctx, input }) => {
      if (!pushReadiness().ready) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "MY PLAN device reminders are not configured yet." });
      const subscription = normalizePushSubscription(input);
      await upsertPushSubscription({
        userId: ctx.user.id,
        endpointHash: hashPushEndpoint(subscription.endpoint),
        encryptedSubscription: encryptPushSubscription(subscription),
        userAgent: input.userAgent,
        expiresAt: subscription.expirationTime ? new Date(subscription.expirationTime) : null,
      });
      const preferences = await getPushReminderPreferences(ctx.user.id);
      await upsertPushReminderPreferences(ctx.user.id, { ...preferences, enabled: true });
      return { enabled: true } as const;
    }),
    unsubscribe: protectedProcedure.input(z.object({ subscriptionId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await revokeOwnedPushSubscription(ctx.user.id, input.subscriptionId);
      return { success: true } as const;
    }),
    disableAll: protectedProcedure.mutation(async ({ ctx }) => {
      await revokeAllOwnedPushSubscriptions(ctx.user.id);
      const preferences = await getPushReminderPreferences(ctx.user.id);
      await upsertPushReminderPreferences(ctx.user.id, { ...preferences, enabled: false });
      return { success: true } as const;
    }),
    scheduleDelivery: protectedProcedure.input(z.object({
      sourceKind: z.enum(["task", "event", "block"]),
      sourceId: z.string().min(1).max(255),
      title: z.string().min(1).max(1024),
      body: z.string().min(1).max(512),
      targetSection: z.enum(["calendar", "todo"]),
      scheduledAt: z.date(),
    })).mutation(async ({ ctx, input }) => {
      if (input.scheduledAt <= new Date()) throw new TRPCError({ code: "BAD_REQUEST", message: "A device reminder must be scheduled in the future." });
      const preferences = await getPushReminderPreferences(ctx.user.id);
      const subscriptions = await listActivePushSubscriptions(ctx.user.id);
      if (!preferences.enabled || !subscriptions.some(subscription => !subscription.expiresAt || subscription.expiresAt > new Date())) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Enable MY PLAN device reminders on a current browser before adding an off-app reminder." });
      }
      await upsertPushReminderDelivery({ ...input, userId: ctx.user.id, deliveryKey: createDeliveryKey(ctx.user.id, input.sourceKind, input.sourceId, input.scheduledAt) });
      return { success: true } as const;
    }),
    cancelDeliveries: protectedProcedure.input(z.object({ deliveryKeys: z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(100) })).mutation(async ({ ctx, input }) => {
      await cancelOwnedPushReminderDeliveries(ctx.user.id, input.deliveryKeys);
      return { success: true } as const;
    }),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
