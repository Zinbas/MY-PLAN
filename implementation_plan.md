# Mobile Calendar Application Plan

## Product Boundary

The application will be a mobile-first, multi-user academic calendar. A person creates an application account through Google’s normal sign-in and consent flow, then links one or more permitted Google Calendar or Google Workspace accounts. A Gmail address is never created by the application; the person creates or manages it directly with Google before signing in.

## Account and Data Model

| Entity | Purpose | Essential fields |
|---|---|---|
| Application user | Person who signs in to the application | Google subject ID, display name, email, avatar, created time |
| Google connection | One linked personal or Workspace Google identity | User ID, Google subject ID, email, scopes, encrypted access and refresh tokens, connection state |
| Linked calendar | Calendar selected for display or writing | Google connection ID, external calendar ID, name, time zone, color, write permission |
| Synced event | Local mirror of an external event | Linked calendar ID, external event ID, title, start/end, recurrence data, attendee data, updated time, deletion state |
| Sync state | Incremental synchronization cursor | Linked calendar ID, next sync token, last successful sync, last error |
| Notification channel | Google Calendar watch subscription | Linked calendar ID, Google channel ID, resource ID, verification token, expiration |
| Academic overlay | Planner milestones independent of linked calendars | Title, category, start/end, study track, visibility |

## Core User Flows

The first flow is **Google account creation or sign-in**. The app opens Google’s standard identity screen. A person can either choose an existing Google account or use Google’s own “Create account” option; any identity verification stays with Google. After consent, the app creates or signs the person into its own account.

The second flow is **link an additional Google account**. An authenticated user selects “Add calendar account,” finishes a separate Google OAuth consent flow, chooses which calendars are visible, and marks one writable default calendar. Multiple Google or approved Workspace accounts can be linked to the same app user.

The third flow is **calendar use and synchronization**. The app lists imported calendars and events, creates, edits, and deletes events against the selected writable Google calendar, then persists the local mirror. A full import runs when a connection is added. Later refreshes use Google’s sync token, while authenticated webhooks request incremental refreshes when changes arrive.

The fourth flow is **Gemini Spark interoperability**. The app exposes an authenticated remote MCP endpoint with safe, focused calendar tools. An eligible Gemini Spark user adds the MCP URL in Gemini’s Connected Apps settings. Spark can read deadlines and propose or request calendar actions through the app, with the user retaining confirmation for writes. This capability is separate from Workspace calendar connectivity because Google currently limits custom Spark apps to eligible personal Google accounts.

## Implementation Options

| Option | Outcome | Tradeoffs | Cost | Setup complexity |
|---|---|---|---|---|
| A. Full two-way calendar sync with Gemini Spark compatibility | Normal Google sign-in, multiple linked accounts, imported and editable events, incremental sync, secure webhooks, and an MCP endpoint for Gemini Spark | Most complete and closest to the requested experience; requires Google OAuth setup, token protection, a verified public callback URL, and maintenance of notification channels | Google API use is generally quota-based; required subscription or hosting costs depend on the user’s Google and Gemini plans | High |
| B. Connected calendar workspace without persistent watch channels | Normal Google sign-in, multiple linked accounts, editable events, manual refresh, and an optional MCP endpoint | Easier and safer initial build, but external changes appear only after user refresh; less automated | Lower ongoing infrastructure needs | Medium |

## External Preconditions

The selected Google Cloud project must have the Google Calendar API enabled, an OAuth consent screen configured, and approved web redirect URIs. The user will need to provide a Google OAuth client ID and client secret through the project’s secure settings. A managed Google Workspace domain may also require an administrator to approve the requested Calendar scopes. Gemini Spark interoperability requires a personal Google account with eligible Spark access, a public standards-compliant MCP URL, and the user’s own connection action in Gemini.

## Reliability and Security Controls

OAuth refresh tokens are stored only server-side and encrypted. The interface uses the narrowest Calendar permission that supports the selected features. Every webhook verifies its channel token and promptly triggers an incremental sync rather than trusting notification bodies. Calendar changes include an optimistic UI state plus server confirmation, clear error recovery, and a “Refresh now” repair action. Revoked access, stale sync tokens, expired notification channels, and Google API errors become visible connection states rather than silent failures.

## References

1. [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
2. [Google Calendar API overview](https://developers.google.com/workspace/calendar/api/guides/overview)
3. [Google Calendar authorization scopes](https://developers.google.com/workspace/calendar/api/auth)
4. [Google Calendar incremental synchronization](https://developers.google.com/workspace/calendar/api/guides/sync)
5. [Google Calendar push notifications](https://developers.google.com/workspace/calendar/api/guides/push)
6. [Gemini Spark custom connected apps](https://support.google.com/gemini/answer/17209137)
7. [Gemini Spark availability and usage](https://support.google.com/gemini/answer/17094507)
