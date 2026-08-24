export function calendarSelectionSaveMessage(result: { isVisible: boolean; syncStatus?: "idle" | "healthy" | "attention" }) {
  if (result.syncStatus === "attention") {
    return "Calendar selection saved. Google sync needs attention; reconnect only if updates remain unavailable.";
  }
  return "Calendar selection saved. MY PLAN will only show and sync the calendars you selected.";
}
