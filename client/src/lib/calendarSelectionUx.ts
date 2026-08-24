export function calendarSelectionSummary(selected: number, total: number) {
  if (!total) return "No calendars available";
  if (!selected) return `Choose the calendars MY PLAN may show`;
  return `${selected} of ${total} calendar${total === 1 ? "" : "s"} selected`;
}
