# MY PLAN Schedule Import Research

## Product decision

MY PLAN will provide a **review-first schedule import**, never an automatic silent import. A user may submit an image, PDF, Office document, spreadsheet, CSV, or iCalendar file, then review every extracted candidate before it becomes a task, event, or focus block.

## Supported import paths

| Source | First-stage treatment | Review requirement |
|---|---|---|
| ICS / iCalendar | Parse structured events and recurrence rules locally. | Show every event and calendar destination before approval. |
| CSV / spreadsheet | Map detected title, date, time, duration, list/course, and notes columns. | Ask the user to confirm column mapping and ambiguous dates. |
| PDF / Word document | Extract readable text, detect timetable rows and date phrases, then create candidates. | Require review for every inferred date, time zone, and recurrence pattern. |
| Image / screenshot | Use server-side multimodal extraction for timetable grids, notices, posters, and handwritten-style routine sheets. | Highlight low-confidence or incomplete items for editing before import. |
| Google Calendar | Let the signed-in user select only their own calendars for initial import and continued sync. | Confirm selected calendars and retain ownership boundaries. |

## Safety and privacy rules

The original upload is stored by user-owned key in private storage. Extraction happens server-side. MY PLAN keeps no event until the user approves it, and it never uses one user’s upload or calendar data to populate another user’s workspace. The administrator’s baseline academic plan remains separate from every ordinary user’s private data.

## Research notes

Google Calendar supports ICS and CSV imports on computers; CSV recurrence can degrade into one-time events, so MY PLAN will preserve recurrence from ICS where available and flag CSV recurrence as a review item.[1]

Academic and working schedules often arrive as institution-specific tables or links rather than directly shareable calendar feeds. An editable candidate-review workflow handles this gap without assuming every schedule is safely machine-readable.[2]

## Model choice

The live project catalog includes vision-capable Gemini models. For uploaded image and document extraction, MY PLAN will use **`gemini-3-flash-preview`** with strict JSON-schema output and explicit confidence values, while structured formats stay deterministic and local. The server will never call a model from the browser.

## References

[1] [Google Calendar Help — Import events to Google Calendar](https://support.google.com/calendar/answer/37118?hl=en&co=GENIE.Platform%3DDesktop)

[2] [AddEvent — Integrate an academic and personal calendar](https://www.addevent.com/blog/how-to-integrate-an-academic-calendar-and-a-personal-calendar)
