const dailyQuotes = [
  "Choose the next useful step, then let it be enough.",
  "A clear plan makes room for a calmer mind.",
  "Small progress counts when it is honest.",
  "Make the work visible before you ask yourself to do it.",
  "Plan for the obstacle; keep moving after it.",
  "Rest is part of a sustainable plan, not a break from it.",
  "One focused hour can change the shape of a week.",
  "Leave a little room for the unexpected.",
  "Start with the task that makes the next task easier.",
  "Your calendar is a guide, not a judgment.",
  "Good work grows from clear next steps.",
  "Make today workable, not perfect.",
];

export function dailyQuoteForDate(date: Date) {
  const localDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayNumber = Math.floor(localDay.getTime() / 86_400_000);
  return dailyQuotes[Math.abs(dayNumber) % dailyQuotes.length];
}
