# Google OAuth Activation Guide

## What is already prepared

MY PLAN has a configuration-gated Google sign-in and calendar-linking backend. The application creates a local app account after the user completes Google’s normal sign-in flow, allows a signed-in person to link additional Google or Workspace calendar accounts, stores refresh tokens only in encrypted server-side fields, and keeps short-lived authorization state records to prevent callback forgery. The current interface remains in clearly labeled demonstration mode until the values below are supplied.

## One-time Google Cloud setup

Create a Google Cloud project that you control, enable the **Google Calendar API**, and configure the OAuth consent screen. While the app is being tested, add yourself to the test-user list. Then create an OAuth 2.0 credential of type **Web application**. Google requires this work to happen in the project owner’s Google account; MY PLAN cannot create or own these credentials on your behalf.

Use the following redirect URI in the OAuth client configuration after the app is published:

```
https://YOUR-PUBLISHED-DOMAIN/api/google/callback
```

For local development, also add the current local or preview callback URL if you intend to test the live flow there. The OAuth client should permit Google Calendar event access and read access to the user’s calendar list. A managed Workspace account may require an administrator to permit these scopes.

## Add the secure project settings

When the Google Cloud client is ready, supply the following project settings through the secure settings interface:

| Setting | Value |
|---|---|
| `GOOGLE_OAUTH_CLIENT_ID` | Google OAuth 2.0 Web client ID |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Google OAuth 2.0 Web client secret |
| `GOOGLE_OAUTH_REDIRECT_URI` | Exact published callback URI shown above |

Once configured, the backend changes `/api/google/health` from `demo` to `live`. The app then enables `/api/google/sign-in` for normal Google app-account creation and `/api/google/connect` for linking additional calendar accounts.

After publishing the site, create the project-level Heartbeat that renews expiring Google Calendar watch channels against the prepared `/api/scheduled/renew-calendar-watches` handler. The route is already protected to accept only an authenticated scheduled invocation. Do not create the schedule before the site is deployed, because a development sandbox cannot receive the platform’s recurring HTTP requests.

## Gemini Spark boundary

The project includes a safe demonstration MCP route at `/api/mcp`. It exposes read-only academic deadlines and the connection status. After deployment and Google activation, this route can be upgraded to authenticated read and confirmed-write tools for Gemini Spark. Gemini Spark availability and connected-app eligibility remain controlled by Google; Workspace calendar synchronization can operate separately from a person’s eligible Gemini Spark access.

## References

1. [Google Calendar API authorization](https://developers.google.com/workspace/calendar/api/auth)
2. [Google Calendar synchronization](https://developers.google.com/workspace/calendar/api/guides/sync)
3. [Google Calendar push notifications](https://developers.google.com/workspace/calendar/api/guides/push)
4. [Gemini Spark custom connected apps](https://support.google.com/gemini/answer/17209137)
