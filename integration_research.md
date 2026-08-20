# Integration Research Notes

Google Calendar exposes calendars, calendar lists, events, settings, and access-control resources through a REST API. Events can be created, updated, deleted, and synchronized using Google OAuth 2.0 access tokens. For persistent client access, a server-side authorization-code flow can retain a refresh token; Google advises requesting only the narrowest scope needed and requesting calendar access at the time a user enables the connection. Relevant read/write scope: `https://www.googleapis.com/auth/calendar.events`. Google’s incremental sync workflow starts with a full event sync, persists `nextSyncToken`, and passes that token on later requests; a `410` response requires clearing the local event state and running a new full sync.

Google Workspace users can authorize the same Calendar API scopes, but organization policy or an administrator can block or require reauthorization for third-party OAuth applications. App-authentication requirements include an OAuth consent screen, an appropriate Google OAuth client, enabled Calendar API access, and approved redirect URIs.

Spark Mail has a built-in calendar that displays and synchronizes the Google Calendar associated with an added Gmail account. Events created or changed through Google Calendar are therefore visible in Spark once the matching Gmail account is enabled there. Spark’s current official documentation describes calendar usage and provider-level synchronization; it does not describe a public Spark calendar API for a third-party application to call directly. The practical integration path is to connect this application to Google Calendar, then let Spark show the same Google account’s calendar data.

## Sources

1. https://developers.google.com/identity/protocols/oauth2
2. https://developers.google.com/workspace/calendar/api/guides/overview
3. https://developers.google.com/workspace/calendar/api/auth
4. https://developers.google.com/workspace/calendar/api/guides/sync
5. https://sparkmailapp.com/help/calendars/enable-and-view-calendars-in-spark
6. https://sparkmailapp.com/blog/calendar-for-desktop

## Gemini Spark Validation

The intended product is Gemini Spark, Google’s background personal AI agent. Gemini Spark can work with Calendar, Gmail, Drive, Docs, Sheets, and other connected Google apps under user direction. Google also permits custom Gemini Spark connected apps when the application exposes a standards-compliant Model Context Protocol (MCP) server at a public URL.

For the calendar application, the validated Spark path is to expose focused MCP tools such as `list_academic_events`, `create_study_block`, `update_study_block`, `delete_study_block`, and `get_deadlines`. A Spark user can then add the application’s MCP server URL in Gemini’s Connected Apps settings and invoke it inside a Spark task. Google’s documentation states that write actions require user confirmation at this time, so the integration should make writes explicit and reversible.

Important product limits shape the architecture. Google Calendar OAuth can work with permitted Google Workspace accounts, subject to organization consent and administrator policy. Gemini Spark and its custom connected apps currently require an eligible personal Google Account, are limited to the U.S. and English, require Keep Activity, and are not currently available with work or school Google Accounts. The final application can therefore support Workspace calendar synchronization and, separately, an optional Spark connection through an eligible personal Google Account; it cannot truthfully promise Spark availability for a Workspace-only user.

The mobile app can create an app account through Google sign-in. It cannot create a new Gmail account for the user: Google account enrollment, identity information, consent, and any verification must stay in Google’s own user-controlled flow.

## Additional Sources

7. https://gemini.google/overview/agent/spark/
8. https://support.google.com/gemini/answer/17094507
9. https://support.google.com/gemini/answer/17209137
10. https://support.google.com/gemini/answer/13695044
11. https://ai.google.dev/gemini-api/docs/deep-research

## Calendar Synchronization Design

Google Calendar supports two compatible synchronization mechanisms. The application can store an incremental `nextSyncToken` after a first full import and use it to request only changed events later. For near-real-time changes, it can establish an `events.watch` notification channel for every linked calendar. Google delivers a no-body HTTPS POST to an application-owned webhook whenever the watched resource changes; the application then runs the incremental sync. Channels expire and require renewal, and the webhook receiver must use a valid public HTTPS certificate.

The full implementation therefore needs a server, database, encrypted token storage, persistent channel metadata, a publicly reachable webhook endpoint, and a renewal job. A manual “Refresh now” action remains necessary as a recovery path when a channel expires, a token is revoked, or Google returns `410 Gone` for a stale sync token.

## Additional Sources

12. https://developers.google.com/workspace/calendar/api/guides/push
13. https://developers.google.com/workspace/calendar/api/v3/reference/events/watch

## Calendar Experience Research — Public User Discussions

Public discussions indicate that people value calendar systems that feel flexible rather than rigid. A thread in r/productivity explicitly calls for easy drag-and-drop rescheduling and month-view duplication, while another participant asks for weekday-aware multi-day events that do not incorrectly include weekends. The same discussion requests optional visual differentiation for days such as holidays without confusing those markers with user-created events.

A separate r/ProductivityApps discussion highlights a frequent overlap between calendar and task behavior: users want to mark scheduled items complete and keep checkable items inside an event. The accompanying poll calls out forgetting or failing to update events, overlapping appointments, and manual typing as calendar-management pain points.

The expanded MY PLAN feature plan should therefore prioritize unrestricted date navigation, a fast “go to today” path, month/week/agenda views, recurring patterns, event completion, in-event checklists, unobtrusive event categories, conflict awareness, search, and rapid rescheduling. These complement rather than replace the app’s academic planning features and Google synchronization foundation.

## Additional Sources

14. https://www.reddit.com/r/productivity/comments/1gh4fhg/whats_your_biggest_frustration_with_calendar_apps/
15. https://www.reddit.com/r/ProductivityApps/comments/1iad038/whats_the_most_frustrating_part_about_managing/
