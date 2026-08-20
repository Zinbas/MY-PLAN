# MY PLAN Study and Professional Planner Research

## Sources reviewed

| Source | Observed need | Product implication for MY PLAN |
|---|---|---|
| [MyStudyLife](https://mystudylife.com/) | Students need classes, homework, exams, revision, reminders, and focus support in a single mobile-friendly workflow. | Keep the calendar as the scheduling spine, add dedicated to-do and progress surfaces, deadline context, a daily focus plan, and clear mobile actions. |
| [Microsoft Planner](https://www.microsoft.com/en-us/microsoft-365/planner/microsoft-planner) | Professional workflows benefit from one place for tasks, to-do lists, plans, projects, “My Day”, status visibility, and multiple views. | Add a work-ready task space with lists, priority, due-state grouping, progress metrics, and a calm daily view before attempting high-complexity collaboration features. |
| [r/productivity discussion](https://www.reddit.com/r/productivity/comments/1gciy7y/best_all_in_one_todo_list_note_taking_calendar/) | Users want a simple all-in-one home for quick capture, tasks, notes, scheduling, and organization, but reject systems that demand lengthy setup or hide functionality behind separate apps. | Use a guided, dismissible first-run tutorial; provide useful defaults and low-friction task capture; expose attached notes directly; avoid requiring users to construct a complex system before they see value. |

## Product decisions

MY PLAN will evolve in a focused sequence rather than becoming an unfocused feature catalogue. The next release will prioritize a **Today workspace**, a dedicated **To-do** workspace with list and due-state views, a **Progress** workspace that turns completed work into understandable metrics, an **onboarding tour**, and clearer account states. Existing local task, personal-event, and study-block data will remain the single source for the initial progress calculations.

The experience will retain the Paper Field Notes character. It should feel like a structured daily notebook rather than a generic corporate dashboard: a welcoming first screen, a small number of intentional actions, clear deadlines, quiet progress signals, and touch-sized controls on mobile. Complex items such as team assignments, collaboration, recurring notifications, grade prediction, live Google synchronization, or an AI coach will stay out of this iteration until the essential personal workflows are independently reliable.

## Required first-release behaviors

| Area | Behavior |
|---|---|
| Welcome and onboarding | Explain Calendar, To-do, Progress, and account linking in a short dismissible walkthrough; preserve completion in local storage. |
| To-do | Capture tasks quickly, filter by list and due state, schedule to the calendar, complete/reopen, reschedule, and retain notes. |
| Progress | Show completed versus open tasks, today’s completion ratio, an upcoming-deadline count, and focused-study completion based on real local data. |
| Account experience | Clearly distinguish signed-out local planning, available app sign-in, Google Calendar demo mode, and Google OAuth activation requirements. |
| Mobile | Make primary actions reachable, make the menu and workspaces unambiguous, preserve space for planning content, and avoid hover-only affordances. |

## Implementation verification notes

The implemented Welcome workspace renders as a clean first-run surface with an explicit local-planning path and a separate account action. The To-do workspace exposes its intended empty state, due-state filters, list filter, and task capture entry point. The Progress workspace renders real-data metric cards and makes its empty state actionable rather than decorative.

Browser validation created a local scheduled task named “Review project brief” through the existing composer using the `Work` list and notes. After saving, it appeared in the selected-day calendar plan with its schedule and lifecycle actions, while the calendar header reflected one open task. This confirms the extended task data remains compatible with the original calendar workflow before the dedicated To-do and Progress views receive their automated coverage.

The To-do workspace then showed the same task under the `Work` list with real open and due-today counts. Its **Start** action switched the task to `in progress`; its **Done** action then switched it to `done`, changed the lifecycle action to **Reopen**, and reduced the live open and due-today metrics to zero. This establishes that the workspace uses persisted planner state rather than visual-only demo data.

The Progress workspace rendered the completed item as `1 / 1` for today, `1` completed task overall, and `100%` for the `Work` list. The Welcome walkthrough opened from its explicit 60-second-tour action and its first two steps correctly switched the background workspace from Calendar to To-do while keeping the tutorial visible. The mobile Welcome screenshot confirmed that the primary actions stack cleanly and the compact top action bar preserves touch targets.
