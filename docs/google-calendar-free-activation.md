# Google Calendar Activation: No-Paid-Product Guardrails

## Purpose

MY PLAN can be tested with **Google Calendar API** and **Google OAuth** only. The activation path must not add Maps, Gemini, paid Google Cloud services, a billing account, or any unrelated API. The live connection remains disabled until the owner enters their own OAuth client credentials through the secure project fields.

## Configuration boundary

| Area | Required for MY PLAN | Explicitly out of scope |
| --- | --- | --- |
| Google APIs | Enable Google Calendar API only | Paid Google Cloud products and unrelated APIs |
| OAuth consent | App name, support contact, audience, test users, minimum Calendar scopes | Broad, unused, or restricted scopes |
| Credentials | User-owned web OAuth client entered securely | Secrets in source control, chat, browser storage, or test fixtures |
| Request behavior | User-triggered connect/sync with existing rate-limit handling | Polling loops or bulk writes without user approval |

## Official limits and safe operating plan

Google documents Calendar API limits of **10,000 requests per minute per project** and **600 requests per minute per user per project**. It also documents a daily per-project billing threshold of **1,000,000 requests**, under which no extra charge applies; Google states that billing changes are subject to notice. MY PLAN’s owner-controlled, per-user actions are designed to remain far below those thresholds. The existing sync design should continue to use incremental synchronization, exponential backoff, and user-initiated calendar selection instead of polling.[1]

For an External testing audience, Google’s current consent-screen guidance requires creating the branding/audience settings and adding the owner plus any permitted testers under **Audience → Test users**. It advises selecting only the minimum scopes needed by the application, which matches MY PLAN’s Calendar-only connection approach.[2]

> The Calendar API itself has no routine per-request charge under the documented threshold, but Google can change future billing rules. Do not attach a billing account or enable a paid product merely to test MY PLAN’s Calendar authorization flow.

## Activation checklist

When the owner is ready, use a Web OAuth client and register only these two redirect URIs:

1. `https://acadcal26-9ch8welq.manus.space/api/google/callback` for MY PLAN Calendar connection.
2. `https://oauth-redirect.googleusercontent.com/r/user_bound_custom-mcp-113394074363922190415-acadcal26-9ch8welq_manus_space` for the separately planned Gemini Spark OAuth flow.

The owner should enter the client ID and client secret through secure project fields. The second URI does **not** activate Spark by itself; Spark additionally requires standards-compliant MCP OAuth implementation and separate validation.

## References

[1]: https://developers.google.com/workspace/calendar/api/guides/quota "Google Calendar API — Usage limits"
[2]: https://developers.google.com/workspace/guides/configure-oauth-consent "Google Workspace — Configure the OAuth consent screen and choose scopes"
