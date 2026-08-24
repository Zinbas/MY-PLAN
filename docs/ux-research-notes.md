# MY PLAN UX Research Notes

## Purpose

This concise research record guides the current usability pass. It prioritizes low-friction daily planning over feature density.

| Finding | Source | MY PLAN implication |
|---|---|---|
| Planner users report that calendar, task, and note tools become cluttered and turn into organization work; search also becomes difficult. | Reddit productivity discussion, *What are some of the problems you face with existing calendar, to-do list, and notetaking apps?* | Keep the primary sidebar limited to Calendar, To-do, Progress, and a single Workspace tools entry. Use progressive disclosure for integrations and secondary utilities. |
| Users want simple, quick task and schedule capture rather than excessive setup. | Same Reddit discussion and related productivity-app threads. | Retain clear top-level Add task, Add event, and Add block actions; simplify labels and keep advanced controls secondary. |
| Ambiguous calls to action such as “Get Started” make it unclear what will happen next. | Nielsen Norman Group, *“Get Started” Stops Users*. | Use explicit labels such as “Sign in to sync” and “Create your MY PLAN account,” not generic onboarding language. |
| Interfaces should keep people informed about system status. | Nielsen Norman Group, *Visibility of System Status*. | Show selected-calendar counts, saving feedback, connection state, and precise retry feedback in account and sync tools. |
| Advanced options should be deferred until needed to reduce cognitive load. | Nielsen Norman Group, *Progressive Disclosure*. | Keep core planning navigation and quick actions visible; place import, reminders, sync, and Spark under Workspace tools. |
| Mobile targets need sufficient size and spacing for accurate interaction. | Nielsen Norman Group, *Touch Targets on Touchscreens*. | Use full-width, minimum-height controls for connected-calendar choices and compact-phone account actions. |

## Implementation priorities

1. Give signed-out users a visible and specific account action from every core planning surface.
2. Keep calendar/task capture one step away, while deferring connection detail until the user intentionally opens Account & Calendar.
3. Make status feedback explicit: saving, connected, selected, retry, and private-to-you boundaries.
4. Use large, card-like selectors for calendars on touch devices rather than dense native-checkbox rows.
5. Pair every asynchronous action with a visible, brief state change—saving, connected, selected, or an actionable retry message—rather than leaving the user to infer success.

## Sources

1. [Reddit: planner, calendar, task, and note application pain points](https://www.reddit.com/r/productivity/comments/1jsuwgc/what_are_some_of_the_problems_you_face_with/)
2. [Nielsen Norman Group: “Get Started” Stops Users](https://www.nngroup.com/articles/get-started/)
3. [Nielsen Norman Group: Visibility of System Status](https://www.nngroup.com/articles/visibility-system-status/)
4. [Nielsen Norman Group: Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
5. [Nielsen Norman Group: Touch Targets on Touchscreens](https://www.nngroup.com/articles/touch-target-size/)
