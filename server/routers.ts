import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { googleActivationChecklist, googleOAuthReadiness, isGoogleOAuthConfigured } from "./googleOAuth";
import { getAdminOverview, listAdminUserDirectory, listOwnedLinkedCalendars, listUserCalendarConnections, listUserSyncedEvents, setManagedUserRole } from "./db";
import { createCalendarEvent, deleteCalendarEvent, setGoogleCalendarSelection, updateCalendarEvent } from "./calendarSync";
import { getGoogleOAuthConfig } from "./googleOAuth";
import { extractUploadedSchedule } from "./scheduleImport";
import { createHash, randomBytes } from "node:crypto";
import { listSparkEvents, replaceSparkAccessToken } from "./db";

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
    })).mutation(({ ctx, input }) => extractUploadedSchedule(ctx.user.id, input)),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
