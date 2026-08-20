# MY PLAN Event and Task Workflow Research

## Evidence reviewed

Google documents that calendar-based tasks can have a start time, estimated duration, deadline, description, task list, recurrence, completion state, and rescheduling behavior. Dated tasks appear directly in the calendar, so a planning tool can combine commitments and work without treating them as the same object. [1][2]

Student-planning guidance from UNC recommends entering exams, papers, projects, travel, and appointments at the semester level; working backward from important deadlines; reserving regular weekly planning time; estimating task effort by course; inserting work into open calendar slots; and preserving buffer time. [3]

A productivity-app discussion describes a recurring user gap: users want tasks to retain a start and end time on the calendar while also remaining unfinished and visible until they are completed. The cited request also calls out fast rescheduling rather than silently losing incomplete work. [4]

## Product decisions for this iteration

| Need observed | MY PLAN behavior |
|---|---|
| Appointments and coursework need different life cycles | Add a dedicated **Event** composer and a separate **Task** composer. Events are time-bound commitments; tasks remain pending until completed. |
| Students plan backward from deadlines | Tasks include a due date, priority, course/list label, notes, optional time block, and a one-tap **Schedule** action. |
| Users need a reliable daily focus list | The selected-day margin gains a combined **Today’s plan** surface for scheduled blocks and due/pending tasks. |
| Incomplete work must not disappear | Completing, reopening, rescheduling, duplicating, and removing tasks will all be explicit actions. |
| Calendar placement matters | Scheduled tasks render alongside events; unscheduled but dated tasks remain visible in the day plan and agenda. |
| Hover should never make actions feel sticky | Menus will be click/tap activated, close on pointer exit, Escape, outside click, and view change, and remain closed until a fresh click/tap. |

## Scope intentionally deferred

Live synchronization of MY PLAN tasks to Google Tasks and task reminders require the user’s Google OAuth credentials and will remain activation-gated. The local planning workflow is implemented and tested independently first.

## References

[1]: https://workspace.google.com/products/tasks/ "Google Tasks: Manage your to-dos"
[2]: https://support.google.com/calendar/answer/9901136?hl=en&co=GENIE.Platform%3DDesktop "Google Calendar Help: Create & manage tasks"
[3]: https://learningcenter.unc.edu/tips-and-tools/using-planners/ "UNC Learning Center: Calendars and College"
[4]: https://www.reddit.com/r/ProductivityApps/comments/1hklc9l/looking_for_an_app_that_combines_features_of/ "Reddit: Looking for an app that combines features of Google Calendar events and tasks"
