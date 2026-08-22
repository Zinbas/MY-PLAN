import { describe, expect, it } from "vitest";
import { calendarsForConnections, connectionsForUser, visibleEventsForCalendars } from "./calendarOwnership";

describe("Google Calendar ownership boundary", () => {
  const connections = [
    { id: 11, userId: 1, email: "admin@example.com" },
    { id: 22, userId: 2, email: "student@example.com" },
  ];
  const calendars = [
    { id: 101, connectionId: 11, isVisible: true, summary: "Admin academic plan" },
    { id: 202, connectionId: 22, isVisible: true, summary: "Student private plan" },
    { id: 203, connectionId: 22, isVisible: false, summary: "Student hidden calendar" },
  ];
  const events = [
    { id: 1001, linkedCalendarId: 101, isDeleted: false, title: "Admin exam" },
    { id: 2001, linkedCalendarId: 202, isDeleted: false, title: "Student deadline" },
    { id: 2002, linkedCalendarId: 203, isDeleted: false, title: "Student hidden event" },
    { id: 2003, linkedCalendarId: 202, isDeleted: true, title: "Deleted student event" },
  ];

  it("keeps connections and selected calendars scoped to their authenticated owner", () => {
    const adminConnections = connectionsForUser(connections, 1);
    const studentConnections = connectionsForUser(connections, 2);

    expect(adminConnections.map(connection => connection.id)).toEqual([11]);
    expect(studentConnections.map(connection => connection.id)).toEqual([22]);
    expect(calendarsForConnections(calendars, adminConnections).map(calendar => calendar.id)).toEqual([101]);
    expect(calendarsForConnections(calendars, studentConnections).map(calendar => calendar.id)).toEqual([202, 203]);
  });

  it("never returns another user's mirrored events and excludes hidden or deleted records", () => {
    const adminCalendars = calendarsForConnections(calendars, connectionsForUser(connections, 1));
    const studentCalendars = calendarsForConnections(calendars, connectionsForUser(connections, 2));

    expect(visibleEventsForCalendars(events, adminCalendars).map(event => event.title)).toEqual(["Admin exam"]);
    expect(visibleEventsForCalendars(events, studentCalendars).map(event => event.title)).toEqual(["Student deadline"]);
  });
});
