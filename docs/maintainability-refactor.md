# MY PLAN Maintainability Refactor

## Completed first stage

The global planner navigation is now isolated in `PlannerSidebar.tsx` with its route vocabulary and Workspace-tools grouping in `plannerNavigation.ts`. This removes global navigation policy and account-status wording from `Home.tsx`, making those boundaries independently testable.

The new local-plan reminder enrollment presentation is also isolated in `reminderWorkspace.css`; `index.css` remains responsible for shared Paper Field Notes tokens, layout primitives, and cross-workspace behavior.

## Next safe slices

The remaining Home page should be separated incrementally, without changing planner data behavior: first the calendar board and filters, then the composer state, then To-do and Progress workspace renderers. Each extraction should preserve existing local-workspace privacy scoping and add focused regression coverage before removing the old inline branch.
