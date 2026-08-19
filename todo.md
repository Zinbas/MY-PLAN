# Mobile Calendar App Upgrade

**Selected build:** Full automatic synchronization with Google Calendar and Workspace accounts.

- [x] Identify the Google agent-style Spark product and confirm its official integration surface.
- [x] Inspect available connector configuration and Google account integration options.
- [ ] Obtain user-owned Google OAuth credentials and consent-screen configuration before enabling live Google account linking.
- [x] Add and verify an explicit empty state for linked Google events while preserving the academic and demo calendar content.
- [x] Add a targeted automated verification for the linked-calendar empty state and record the result.
- [x] Render persisted synced Google events alongside academic and demo items with loading, empty, and error states.
- [x] Harden webhook synchronization with channel verification, incremental idempotent synchronization, expiry checks, and prepared watch renewal.
- [x] Add persisted-calendar event creation, editing, and deletion controls with clear OAuth-disabled states.
- [x] Expose the prepared real Google sign-in entrypoint and a persisted linked-account screen while retaining explicit demo behavior when OAuth is unavailable.
- [x] Implement protected procedures for listing multiple persisted Google or Workspace connections and selected calendars.
- [x] Implement calendar import and mirrored-event persistence after OAuth callback, then surface persisted events in the app.
- [x] Replace the webhook placeholder with channel-token validation and incremental sync dispatch.
- [x] Implement guarded persisted-calendar event creation, editing, and deletion with clear demo-mode disabled states.
- [x] Research current Google Calendar API, Google Workspace OAuth, and relevant calendar-app functionality.
- [x] Produce a validated product plan before writing the authenticated synchronization flows.
- [x] Define the mobile data model, sync scope, authentication model, and required credentials.
- [x] Prepare normal Google sign-in for app account creation and multiple linked Google Calendar or Workspace accounts per app user.
- [x] Provide a clearly labeled local demonstration mode for account linking, calendar operations, and sync states while real Google OAuth credentials are unavailable.
- [x] Upgrade the project to the required full-stack capability.
- [x] Prepare sign-in, Google Calendar authorization, event persistence, and secure synchronization routes for activation when user-owned credentials are supplied.
- [x] Implement mobile calendar navigation, event details, and academic-date overlays.
- [x] Add the validated Google Spark integration or document a feasible alternative if no public integration exists.
- [x] Run type checks, builds, and end-to-end flow verification; fix defects found.
- [x] Complete all credential-free work autonomously before requesting the user’s Google OAuth activation inputs.
- [ ] Save a checkpoint and deliver the verified application.
