# Native MY PLAN Web-Push Reminder Design

## Product boundary

MY PLAN will offer **optional native web-push reminders** as its primary off-app notification channel. A user explicitly enables the feature from MY PLAN, reviews what it does, and then grants their browser permission. The feature never prompts on page load, never enables itself silently, and always provides a visible disable path.

> The Push API can deliver a message to an application’s service worker even when the web app is not in the foreground or currently loaded, provided that the user has subscribed. [1]

## Delivery design

| Layer | Responsibility | Privacy boundary |
| --- | --- | --- |
| MY PLAN interface | Explains permission, manages default timing and quiet hours, and lets a user enable or disable reminders. | A user controls their own settings and devices only. |
| Browser service worker | Receives encrypted push payloads, renders a concise MY PLAN system notification, and opens only the supplied MY PLAN route when clicked. | No third-party analytics or device tracking. |
| Subscription storage | Stores each user’s push endpoint and encryption keys, plus minimal device metadata and revocation state. | Endpoint values are treated as secret capability URLs and never sent to another user. [1] |
| Reminder schedule | Persists only the user-approved reminder title, route, source identity, scheduled time, and lifecycle state needed for delivery. | No administrator UI exposes individual reminder content. |
| Background dispatcher | Claims due reminders idempotently, suppresses delivery during quiet hours, sends to the user’s active subscriptions, and revokes invalid subscriptions. | Every query and delivery operation is scoped to one user. |

MY PLAN will use a one-minute background dispatch cadence after deployment. This is deterministic scheduled work, not an AI task. The dispatcher will be idempotent because delivery retries and duplicate executions are possible. It will send a system notification via the service worker, which is the mobile-safe notification mechanism; direct page-created notifications are not suitable for many mobile browsers.[2]

## User controls

The initial preferences will intentionally stay compact:

| Control | Initial choices |
| --- | --- |
| Device reminders | Enable, disabled, browser blocked, or setup pending |
| Default lead time | At start, 10 minutes, 30 minutes, 1 hour, or 1 day before |
| Quiet hours | Off, or a local start/end time range |
| Item eligibility | Scheduled tasks, personal events, and focus blocks with a time; all-day dates remain in the in-app center unless the user adds a time. |
| Device management | Disable this device and revoke all MY PLAN device reminders. |

Each notification will use the MY PLAN name, the user’s approved item title, concise timing context, the supplied note-mark icon, and a safe route back into the user’s own Calendar or To-do section. Repeated delivery attempts use a stable notification tag to avoid notification floods.[2]

## Activation prerequisites

Native delivery requires an HTTPS production origin, a service worker, a secure VAPID public/private key pair, and a deployed scheduled callback. The VAPID private key is server-only; the public key is returned to authenticated clients only for subscription creation. No key is embedded in source control, test fixtures, local storage, or push payloads.

The current implementation will expose a clear **setup pending** state until VAPID keys are supplied securely. Only then can a user subscribe a device, and only after the deployed dispatcher is enabled can reminders be delivered while MY PLAN is closed.

## Permission and reliability policy

MY PLAN will ask only after an intentional user action. This avoids browser blocks and gives users an understandable choice; browsers require a secure context and increasingly reject prompts not triggered by a user gesture.[2] [3] A denied permission is respected, with a concise browser-settings recovery explanation rather than repeated prompts.

Web push is a browser capability, so delivery can still be affected by device settings, operating-system focus modes, connectivity, or browser support. The in-app Notification Center remains available as a complementary planning surface, and Google Calendar remains optional rather than being treated as the only reminder system.

## References

[1]: https://developer.mozilla.org/en-US/docs/Web/API/Push_API "MDN — Push API"
[2]: https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API "MDN — Using the Notifications API"
[3]: https://web.dev/articles/permissions-best-practices "web.dev — Web permissions best practices"
