# Ongoing Calendar Verification Record

## Scope

The fixed August–December 2026 calendar was replaced with an ongoing calendar that can move across year boundaries, jump directly to any month, and show month, week, or next-30-day agenda views. Local study blocks now support completion, copying, a one-day reschedule action, removal, source filtering, search, and recurring patterns. The existing Google Calendar and Gemini Spark foundation remains explicitly disabled until user-owned OAuth credentials are provided.

## Defect Found and Resolved

During browser-driven interaction testing, the agenda view did not display a newly created study block after the user had jumped to a future month. The cause was that the agenda end date was based on the next 30 days but its start date still used the browsed month cursor, producing an invalid range. The calendar now uses the current date as the agenda start and the following 30 days as the agenda end. The corrected workflow passed the full desktop interaction suite.

## Automated Results

| Verification area | Result |
|---|---|
| Unit tests | 12 tests passed across six test files |
| TypeScript | `pnpm check` passed |
| Production build | `pnpm build` passed |
| Desktop interaction suite | 22 interaction assertions passed |
| Mobile interaction suite | 11 interaction assertions passed |
| Desktop visual review | Calendar grid and selected-day editorial margin verified at 1440×960 |
| Mobile visual review | Navigation, controls, grid, and notes margin verified at 390×844 |
| Google readiness route | Returns explicit demonstration mode while credentials are absent |
| Gemini Spark MCP route | Documented JSON-RPC route responds with HTTP 200 for the supported demonstration status tool |

## Interaction Coverage

The desktop suite covered previous and next month navigation, Today, future month jump, all three views, Accounts, Sync center, Gemini Spark, the MCP copy action, the disabled Google activation button, event search, source filter selection, selected-date updates, planner composer open/close, study block create, complete, duplicate, reschedule, and removal actions.

The mobile suite covered the phone viewport, navigation drawer open/close behavior, Accounts and Calendar navigation, month/week/agenda switching, selected-day context, and planner dialog opening and closing.

## Remaining External Activation

Real Google sign-in, multiple Google or Workspace account linking, live event import, and automatic watch-channel renewal are fully prepared in the codebase but cannot be activated or tested against a real Google account until the application owner adds Google OAuth credentials and a consent-screen configuration. This boundary is shown in the product instead of being simulated as a live connection.
