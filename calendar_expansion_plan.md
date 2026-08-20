# MY PLAN — Ongoing Calendar Expansion Plan

## Design Objective

MY PLAN will become an **ongoing personal and academic calendar**, rather than a fixed August–December 2026 planner. Its existing Paper Field Notes aesthetic will remain, but calendar navigation will be based on the user’s actual date rather than a bounded semester range. The academic planner dates will be preserved as an overlay within the broader calendar.

## Research Synthesis

| Observed need | Evidence | Product response |
|---|---|---|
| Fast, flexible rescheduling | Public calendar-app discussions request simple dragging, copying, and flexible movement of events. [1] | Add draggable/reschedulable local events and quick duplication controls, with corresponding Google sync support when enabled. |
| Ongoing recurrence and weekday-aware routines | Users describe recurrence cases that should exclude weekends or follow a specific weekday pattern. [1] | Add repeat patterns for daily, weekdays, weekly, monthly, and custom end dates. |
| Calendar items that behave like actionable work | Users ask to tick scheduled items off and use checkable items within event context. [2] | Add completion state and lightweight checklists to local planning blocks. |
| Calendar plus tasks in one view | Google Tasks displays dated tasks in Calendar, supports reminders, repeating tasks, subtasks, and priorities. [3] | Add a focused agenda with completion and priority, separating fixed events from planned study blocks. |
| Multi-calendar awareness | Outlook supports availability, RSVPs, and shared calendars; Notion puts external calendar events beside project items. [4] [5] | Keep multi-account linking, calendar visibility controls, a unified agenda, and clear source labels. |

## Planned Architecture

The calendar will use a **continuous date cursor**. Month navigation increments or decrements the cursor without year bounds. A `Today` action resets the cursor to the current date. Month, week, and agenda views will operate on the same event source, so a change to a local event, academic overlay, or later Google-synced event is visible consistently.

Academic dates remain immutable reference events, while user-created study blocks are editable and can carry completion or priority state. The existing Google Calendar pathway remains the source of truth for linked external events when OAuth is activated; local planning blocks stay available in demonstration mode.

## Prioritized Implementation

| Priority | Feature | Scope for this build |
|---|---|---|
| P0 | Unlimited month navigation | Any past or future month; direct month/year jump and `Today` action. |
| P0 | Multiple views | Month grid, week timeline, and agenda/list view. |
| P0 | Search and filters | Search visible events by title; filter academic, local planning, and linked-calendar sources. |
| P0 | Persistent local planner blocks | Editable local study blocks with completed state and priority marker. |
| P1 | Repeat patterns | Daily, weekdays, weekly, monthly, and custom completion dates for local planning blocks. |
| P1 | Conflict awareness | Identify visible overlapping timed local blocks. |
| P1 | Quick actions | Add, duplicate, reschedule, complete, and clear-completed controls. |
| P2 | Google activation | Existing OAuth, import, CRUD, watch, and Spark preparation become live when the app owner supplies the required credentials. |

## References

[1] [r/productivity — Calendar app frustrations](https://www.reddit.com/r/productivity/comments/1gh4fhg/whats_your_biggest_frustration_with_calendar_apps/)

[2] [r/ProductivityApps — Calendar management frustrations](https://www.reddit.com/r/ProductivityApps/comments/1iad038/whats_the_most_frustrating_part_about_managing/)

[3] [Google Tasks product page](https://workspace.google.com/products/tasks/)

[4] [Outlook for iOS and Android](https://www.microsoft.com/en-us/microsoft-365/outlook-mobile-for-android-and-ios)

[5] [Notion Calendar](https://www.notion.com/product/calendar)
