# Calendar Header Collision Observation

The supplied 1080 × 161 browser crop was read in two overlapping left-to-right tiles. At the boundary between the calendar workbench and selected-day panel, the calendar’s lower filter row continues beneath the selected-day panel rather than reserving its horizontal space. The view tabs themselves remain visible, but the right edge of the **All sources**, **Filters**, and month controls is clipped by the panel boundary.

The repair must therefore preserve the panel’s dedicated grid column at constrained laptop widths and allow the calendar filter controls to wrap or reduce to an available-width layout before that boundary. No planner content or user data is implicated.
