# Published Post-release Validation — 2026-08-25

The published MY PLAN shell completed its branded loading state and rendered the signed-out Calendar workspace normally. At the browser’s standard desktop width, the calendar workbench, view controls, filter row, and selected-day panel were distinct and readable.

The published browser already has historical welcome state, so it correctly did not show the new-visitor decision again. The decision logic is separately covered by regression tests and applies only when no prior welcome, tour, or explicit entry-completion key exists.
