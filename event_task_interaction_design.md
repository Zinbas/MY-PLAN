# MY PLAN Event, Task, and Interaction Design

## Local planning entities

| Entity | Required fields | Behavior |
|---|---|---|
| `PlannerBlock` | title, start, end, priority, recurrence | Existing focused study session. It can recur and may be completed, copied, moved one day, or removed. |
| `PersonalEvent` | title, date, start, end, priority, course/list label, notes | A time-bound commitment such as a lecture, exam preparation session, appointment, or deadline meeting. It is rendered on month, week, agenda, and selected-day views, and supports edit, copy, reschedule, and removal. |
| `PlanTask` | title, due date, priority, course/list label, notes, optional scheduled time and duration, completion state | A work item that remains in the pending list until marked done. When scheduled, it also renders in calendar views. Due-but-unscheduled tasks remain visible in the selected-day plan and agenda. |

All local entities are stored independently in browser storage until a signed-in user activates the prepared Google OAuth connection. Existing study blocks retain their storage key and serialization shape for backward compatibility.

## Interaction model

The calendar keeps the existing click/tap model for persistent controls. Every popover is controlled explicitly by state rather than by CSS hover. A pointer leaving an open popover closes it after a short delay; entering it again cancels that dismissal. Outside pointer down, Escape, view changes, and selecting an item also close all popovers. Therefore a previously clicked menu cannot remain visible or reopen merely because the cursor later passes over its trigger.

Buttons use a restrained 160ms transform/colour transition and a 0.97 active-scale response. Popovers enter from 0.96 scale and opacity zero, respect reduced-motion preferences, and never depend on a hover-only interaction so the same controls work on touch devices.

## User-facing workflow

The top bar gains separate **Add event** and **Add task** actions while retaining **Add block** for focused study. The selected-day margin becomes **Today’s plan**, which lists time-bound events, scheduled tasks, and due tasks together. Each item exposes a compact explicit action row: complete/reopen for tasks, edit, duplicate, move one day, and remove when appropriate.
