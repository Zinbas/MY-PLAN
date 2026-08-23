# Public Import Validation Sources

This project may use the following public source only in isolated, non-writing importer checks. No candidate from this source is approved or written to any MY PLAN workspace during validation.

| Source | URL | Intended use |
| --- | --- | --- |
| Pearson Higher Education, *Course Syllabus* sample PDF | https://www.pearsonhighered.com/assets/samplechapter/0/1/3/5/0135145732.pdf | Public 24-page course-syllabus document; inspect for explicit schedule, deadline, and timing content before an isolated review-first extraction check. |
| Texas A&M University–Texarkana, *ENGL 1301.03W Course Syllabus* | https://www.tamut.edu/faculty/syllabi/202620/20639.pdf | Public 13-page Spring 2026 syllabus. Search discovery identifies module deadlines with 11:59 PM times; use as the explicit-date/time candidate for a later isolated review-only extraction check. |
| GATE 2026, IIT Guwahati, *Examination Schedule* | https://gate2026.iitg.ac.in/examination-schedule.html | Official schedule table and a public image rendering it. The table visibly pairs full February 2026 dates with 9:30 am–12:30 pm and 2:30 pm–5:30 pm sessions, making it suitable for a non-writing explicit image date/time extraction check. |

## Isolated outcome

The public sample’s embedded class schedule names January and February dates but does not specify a year or start time. The isolated review-only validation therefore produced **four editable candidates with no calendar-ready date or time**, and it did not call calendar, task, workspace, or storage-write functionality. This confirms that ambiguous source dates remain review-only instead of being silently invented. A separate public sample with explicit full dates and times is still required for selected-import write-readiness validation.

The Texas A&M University–Texarkana public syllabus did provide explicit module deadlines. The isolated review-only validation found **three candidates with full date-and-time values**, including Module 1 due **2026-03-14 at 23:59**. This confirms that clear source dates and times are retained as editable review candidates. It did not invoke calendar, task, workspace, or storage-write functionality.

The isolated public Montgomery Public Schools 2026–2027 academic-calendar image validation produced **20 review candidates**, of which **15 retained visible dates** (including **2026-08-10**) and **none received an invented time**. A companion browser regression mocked only public-image-style review candidates, confirmed that the user can edit a selected event title, date, and optional time, and verified that only the selected edited event is written to a disposable private test scope. The unselected image candidate was excluded and the test scope was restored afterward. The visible source image does not contain explicit event times, so the separate explicit-image date-and-time accuracy validation remains open.

The public GATE 2026 examination-schedule image was cross-checked against the official IIT Guwahati schedule table. The isolated image extraction produced **eight dated, timed event candidates**. It retained all required verification pairs—**2026-02-07 09:30**, **2026-02-07 14:30**, and **2026-02-14 14:30**—with a three-hour duration for each session. This validation invokes no calendar, task, workspace, or storage write functionality, so the values remain review candidates only. The public source table and its corresponding image agree on the sampled date-time entries.[1]

## References

[1]: https://gate2026.iitg.ac.in/examination-schedule.html "GATE 2026 Examination Schedule — IIT Guwahati"
