# Vercel free-tier findings

Source checked: https://vercel.com/docs/cron-jobs/usage-and-pricing (accessed 2026-08-26)

Vercel Cron Jobs are available on all plans, but the Hobby plan permits cron jobs only once per day, with hourly timing precision (±59 minutes). Cron expressions that run more than once per day, including every-minute or every-hour schedules, fail deployment. The MY-PLAN repository currently documents and implements a one-minute background dispatcher for push reminders and also has a scheduled calendar-watch renewal route. Therefore, those recurring jobs cannot remain on Vercel Hobby unchanged. The free migration must either disable/reduce those background features, use a separate free external scheduler that calls a protected endpoint, or move to a paid Vercel plan.

The repository’s build passes with `pnpm check` and `pnpm build` in the current checkout. The server currently starts a long-lived Express listener and uses Manus-specific OAuth, Forge-backed storage, and Forge-backed LLM calls, so it is not yet a drop-in Vercel serverless deployment.


Vercel Functions documentation: https://vercel.com/docs/functions/limitations (accessed 2026-08-26)

The Hobby plan allows Node.js/Bun/Python functions up to 300 seconds maximum duration and lists a 250 MB uncompressed function size limit. This is compatible with request/response API routes, but it does not provide a persistent Express server or in-process background worker. Long-running listeners and timers must be removed or replaced with serverless handlers and external scheduling.


Vercel Express documentation: https://vercel.com/docs/frameworks/backend/express (accessed 2026-08-26)

Vercel supports Express with zero configuration when the application is exported from a recognized entrypoint such as `index.ts`, `server.ts`, or `src/index.ts`. The Express app becomes a single Vercel Function. `express.static()` is ignored for static assets, which must instead be placed under `public/`. This supports the migration approach of exporting a reusable app factory and copying the Vite build output into `public/` during the build.
