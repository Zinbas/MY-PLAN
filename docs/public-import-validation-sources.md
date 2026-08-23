# Public Import Validation Sources

This project may use the following public source only in isolated, non-writing importer checks. No candidate from this source is approved or written to any MY PLAN workspace during validation.

| Source | URL | Intended use |
| --- | --- | --- |
| Pearson Higher Education, *Course Syllabus* sample PDF | https://www.pearsonhighered.com/assets/samplechapter/0/1/3/5/0135145732.pdf | Public 24-page course-syllabus document; inspect for explicit schedule, deadline, and timing content before an isolated review-first extraction check. |
| Texas A&M University–Texarkana, *ENGL 1301.03W Course Syllabus* | https://www.tamut.edu/faculty/syllabi/202620/20639.pdf | Public 13-page Spring 2026 syllabus. Search discovery identifies module deadlines with 11:59 PM times; use as the explicit-date/time candidate for a later isolated review-only extraction check. |

## Isolated outcome

The public sample’s embedded class schedule names January and February dates but does not specify a year or start time. The isolated review-only validation therefore produced **four editable candidates with no calendar-ready date or time**, and it did not call calendar, task, workspace, or storage-write functionality. This confirms that ambiguous source dates remain review-only instead of being silently invented. A separate public sample with explicit full dates and times is still required for selected-import write-readiness validation.

The Texas A&M University–Texarkana public syllabus did provide explicit module deadlines. The isolated review-only validation found **three candidates with full date-and-time values**, including Module 1 due **2026-03-14 at 23:59**. This confirms that clear source dates and times are retained as editable review candidates. It did not invoke calendar, task, workspace, or storage-write functionality.
