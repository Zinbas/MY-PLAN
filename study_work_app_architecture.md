# MY PLAN Study and Work App Architecture

## Product stance

MY PLAN remains a personal planning tool, not an enterprise project-management clone. The interface will retain its Paper Field Notes character while offering a coherent day-to-day workflow for a student, an independent professional, or a user balancing both roles. The core promise is simple: **capture work quickly, decide what matters today, schedule focused time, and see honest progress.**

## Workspace navigation

| Workspace | Primary question | First-release content |
|---|---|---|
| Welcome | “How do I get value from MY PLAN?” | First-run welcome, account state, a compact snapshot, and a guided first action. |
| Calendar | “When will I do it?” | Existing ongoing month, week, agenda, events, and study blocks. |
| To-do | “What needs attention?” | Quick capture, list filters, due-state groups, priority, scheduled/unplanned state, notes, and task lifecycle actions. |
| Progress | “How am I moving forward?” | Real completion metrics, today’s ratio, upcoming work, focused-study completion, and task-list breakdown. |
| Accounts | “Where is my data connected?” | Clear app sign-in state, Google Calendar connection status, and the OAuth readiness explanation. |
| Sync center | “Is Calendar current?” | Existing sync health surface. |
| Gemini Spark | “What can the agent read?” | Existing MCP information. |

## Data model extension

The existing local `PlanTask` data will be extended rather than replaced so that existing tasks keep working. The first release will persist the following in local storage and compute metrics from that live data.

| Field | Meaning | Default / migration behavior |
|---|---|---|
| `course` | The current list or context for a task. | Existing field; treated as a list label. |
| `status` | `open`, `in-progress`, or `done`. | Existing `completed` maps to `done`; otherwise `open`. |
| `completedAt` | When a task was completed. | `null` for current tasks; set when the user marks a task done. |
| `createdAt` | Local creation timestamp for task-history and progress summaries. | Added lazily for existing tasks. |
| `estimateMinutes` | Planned effort used in daily workload summaries. | Uses existing `durationMinutes` where available. |

The app will preserve `completed` for backward compatibility with the current calendar views and will keep it synchronized with `status`.

## Welcome and account model

The welcome experience is a dismissible **first-run layer**, not a login wall. Users can plan locally without signing in. The welcome surface explains this distinction and offers two clear paths: begin planning locally or sign in to establish the MY PLAN account used for connected services. `startLogin()` will run only from a deliberate click handler. A signed-in state will show the account name, email, and a safe sign-out action; Google Calendar remains clearly labelled as separately connected and only becomes active after the activation configuration is finished.

## Tutorial sequence

The tutorial will be a four-step overlay stored under `my-plan-tour-complete` in local storage. It covers **Calendar**, **To-do**, **Progress**, and **Accounts**, and users can skip or replay it from Welcome. It must be keyboard-accessible, have an obvious close button, avoid hover-only behavior, and respect reduced-motion preferences.

## Progress calculations

The first release will not invent grades, streaks, or productivity scores. It will report only metrics supportable by locally stored user actions:

| Metric | Calculation |
|---|---|
| Today completion | Completed tasks due today ÷ all tasks due today, with a clear empty state. |
| Open tasks | All tasks not marked completed. |
| Upcoming deadlines | Open tasks due in the next seven days. |
| Focus completion | Completed study blocks in the selected/current day and week. |
| List progress | Completed tasks in each course/list ÷ all tasks in that course/list. |

## Mobile principles

The mobile interface will make the current workspace and add action visible without crowding the screen. The navigation overlay will include the new workspaces and close after selection. Workspace cards will use a single-column layout, full-width touch targets, and content before decoration. The tutorial will adapt to small screens as a bottom-sheet-style card rather than an oversized centered modal.

## Deliberate exclusions for this release

The initial expansion will not introduce collaboration, invented sample productivity outcomes, background reminders, notifications, external note syncing, billing, or grade prediction. These require additional policy, integration, or persistence work and should follow after the personal workflow is proven stable.
