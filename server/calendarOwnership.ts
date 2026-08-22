export type OwnedConnection = { id: number; userId: number };

export type OwnedCalendar = {
  id: number;
  connectionId: number;
  isVisible: boolean;
};

export type OwnedSyncedEvent = {
  id: number;
  linkedCalendarId: number;
  isDeleted: boolean;
};

/**
 * Limits calendar records to the authenticated owner before any caller can
 * display, select, or mutate them. Keeping this rule pure makes the critical
 * two-user boundary independently regression-testable.
 */
export function connectionsForUser<T extends OwnedConnection>(connections: T[], userId: number): T[] {
  return connections.filter(connection => connection.userId === userId);
}

export function calendarsForConnections<T extends OwnedCalendar>(calendars: T[], connections: OwnedConnection[]): T[] {
  const connectionIds = new Set(connections.map(connection => connection.id));
  return calendars.filter(calendar => connectionIds.has(calendar.connectionId));
}

export function visibleEventsForCalendars<T extends OwnedSyncedEvent>(events: T[], calendars: OwnedCalendar[]): T[] {
  const visibleCalendarIds = new Set(calendars.filter(calendar => calendar.isVisible).map(calendar => calendar.id));
  return events.filter(event => visibleCalendarIds.has(event.linkedCalendarId) && !event.isDeleted);
}
