import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { googleActivationChecklist, isGoogleOAuthConfigured } from "./googleOAuth";
import { listOwnedLinkedCalendars, listUserCalendarConnections, listUserSyncedEvents } from "./db";
import { createCalendarEvent, deleteCalendarEvent, updateCalendarEvent } from "./calendarSync";

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
  calendar: router({
    readiness: publicProcedure.query(() => ({
      mode: isGoogleOAuthConfigured() ? "live" : "demo",
      googleOAuthReady: isGoogleOAuthConfigured(),
      activationChecklist: googleActivationChecklist,
      sparkMcpStatus: "prepared" as const,
    })),
    connections: protectedProcedure.query(({ ctx }) => listUserCalendarConnections(ctx.user.id)),
    linkedCalendars: protectedProcedure.query(({ ctx }) => listOwnedLinkedCalendars(ctx.user.id)),
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

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
