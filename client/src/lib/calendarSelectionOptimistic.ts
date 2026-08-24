export type SelectableCalendar = { id: number; isVisible: boolean };
export type SelectableConnection<T extends SelectableCalendar = SelectableCalendar> = { calendars: T[] };

/** Mirrors one user-authorized choice locally so the card responds before network persistence completes. */
export function applyOptimisticCalendarSelection<T extends SelectableConnection>(connections: T[] | undefined, linkedCalendarId: number, isVisible: boolean) {
  return connections?.map(connection => ({
    ...connection,
    calendars: connection.calendars.map(calendar => calendar.id === linkedCalendarId ? { ...calendar, isVisible } : calendar),
  })) as T[] | undefined;
}
