# MY PLAN Security Boundaries

## Scope of this hardening pass

MY PLAN keeps personal planning data private through user-scoped persistence, protected server procedures, and administrator restrictions. This pass adds request-boundary protections and reduces unnecessary disclosure without changing a user’s calendar, tasks, events, imported files, or connection choices.

| Boundary | Current control | Verification |
| --- | --- | --- |
| Browser response protection | `nosniff`, anti-framing, referrer, permissions, opener, and minimal CSP headers are emitted by the application server. | Focused middleware regression and live HTTP header check. |
| Unsafe cross-origin requests | Browser requests with a mismatched `Origin` header are rejected before state-changing route handlers run. Same-origin and server-to-server requests remain supported. | Unit regression and HTTP `403` smoke check. |
| Private API responses | Requests beneath `/api/` are marked `Cache-Control: no-store`. | Middleware regression. |
| Request size | JSON is limited to 15 MB; URL-encoded requests are limited to 16 KB. Schedule extraction independently limits decoded uploads to 10 MB. | Server configuration review and existing importer tests. |
| Private MCP credential | The legacy compatible-client endpoint accepts bearer credentials only, does not cache responses, and challenges unauthenticated requests as bearer authentication. | MCP regression coverage. |
| Calendar/OAuth failures | Credential-pending and renewal errors use safe generic responses and do not reveal OAuth values or internal exception text. | Google readiness and route regressions. |
| Administrator scope | The Administrator panel exposes aggregate operational totals only. Account & Calendar and Sync Center remain user-facing utilities under Workspace tools. | Three-session browser privacy regression. |
| Production dependencies | Unused template chat and chart surfaces were removed. SheetJS now uses the current official distribution; audited HTTP, data, and identifier libraries were upgraded. | Final `pnpm audit --prod` produced no remaining findings. |

## Important limitation

The current private MCP bearer flow is deliberately **not represented as Gemini Spark-compatible OAuth**. The planned standards-based OAuth upgrade remains separate and requires secure client configuration before activation. No security control in this pass enables Google Calendar or Gemini Spark without the owner’s credentials.

## Validation record

The hardening update passed **66 Vitest tests**, TypeScript checking, a production build, focused HTTP header inspection, cross-origin write rejection, the administrator/member/guest privacy browser regression, spreadsheet-import regression coverage after the SheetJS upgrade, and a clean production dependency audit. The security controls are defense-in-depth measures; continued credential hygiene, dependency updates, and live OAuth verification remain required before enabling external account connections.
