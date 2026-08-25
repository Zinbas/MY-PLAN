import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dbSource = readFileSync(new URL("./db.ts", import.meta.url), "utf8");

function functionBody(name: string) {
  const start = dbSource.indexOf(`export async function ${name}`);
  const end = dbSource.indexOf("\nexport async function", start + 1);
  return dbSource.slice(start, end === -1 ? undefined : end);
}

describe("calendar database query scoping", () => {
  it("queries connections by the authenticated user before loading linked calendars", () => {
    const body = functionBody("listUserCalendarConnections");
    expect(body).toContain("where(eq(calendarConnections.userId, userId))");
    expect(body).toContain("inArray(linkedCalendars.connectionId, connectionIds)");
    expect(body).not.toContain("connectionsForUser(await db.select().from(calendarConnections)");
  });

  it("limits owned calendars and synced events to the authenticated user's visible calendar ids in SQL", () => {
    expect(functionBody("listOwnedLinkedCalendars")).toContain("where(eq(calendarConnections.userId, userId))");
    const eventBody = functionBody("listUserSyncedEvents");
    expect(eventBody).toContain("inArray(syncedEvents.linkedCalendarId, visibleCalendarIds)");
    expect(eventBody).toContain("eq(syncedEvents.isDeleted, false)");
  });

  it("never loads an arbitrary synced event before proving calendar ownership", () => {
    const body = functionBody("getUserSyncedEvent");
    expect(body).toContain("inArray(syncedEvents.linkedCalendarId, ownedCalendarIds)");
    expect(body).not.toContain("where(eq(syncedEvents.id, eventId)).limit(1)");
  });
});
