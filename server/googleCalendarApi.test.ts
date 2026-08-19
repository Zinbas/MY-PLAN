import { describe, expect, it } from "vitest";
import { mapGoogleEvent } from "./googleCalendarApi";

describe("Google Calendar event mapping", () => {
  it("normalizes a timed Google event into a safe persisted event shape", () => {
    const result = mapGoogleEvent({ id: "evt-1", summary: "Java lab", start: { dateTime: "2026-08-17T10:00:00Z" }, end: { dateTime: "2026-08-17T11:00:00Z" }, updated: "2026-08-01T00:00:00Z" });
    expect(result).toMatchObject({ externalEventId: "evt-1", title: "Java lab", isAllDay: false, eventStatus: "confirmed" });
    expect(result.startAt).toEqual(new Date("2026-08-17T10:00:00Z"));
  });

  it("recognizes all-day Google events", () => {
    const result = mapGoogleEvent({ id: "evt-2", start: { date: "2026-08-28" }, end: { date: "2026-08-29" } });
    expect(result.isAllDay).toBe(true);
    expect(result.title).toBe("Untitled event");
  });
});
