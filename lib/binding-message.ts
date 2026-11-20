export const TITLE_MAX = 20;
export const DURATIONS = [15, 30, 60] as const;

export type CalendarAction = {
  title: string;
  start: string;
  duration: (typeof DURATIONS)[number];
};

export function parseCalendarAction(input: unknown, now = Date.now()): CalendarAction | null {
  if (!input || typeof input !== "object") return null;
  const { title, start, duration } = input as Record<string, unknown>;
  const summary = typeof title === "string" ? title.trim().replace(/ +/g, " ") : "";
  if (!/^[A-Za-z0-9][A-Za-z0-9 +_.:,#-]*$/.test(summary) || summary.length > TITLE_MAX) {
    return null;
  }
  if (typeof start !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(start)) {
    return null;
  }
  const date = new Date(`${start}Z`);
  if (!(date.getTime() > now) || date.toISOString().slice(0, 16) !== start) return null;
  if (duration !== 15 && duration !== 30 && duration !== 60) return null;
  return { title: summary, start, duration };
}

export function calendarBindingMessage(action: CalendarAction, reference: string) {
  return `Calendar:Add:${action.start}Z:${action.duration}m:${action.title.replaceAll(" ", "-")}:${reference}`;
}
