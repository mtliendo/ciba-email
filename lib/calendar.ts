import type { CalendarAction } from "./binding-message.ts";

export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events.owned";

export function linkGoogleCalendar() {
  const query = new URLSearchParams({
    connection: googleConnection(),
    scopes: CALENDAR_SCOPE,
    prompt: "consent",
    returnTo: "/",
  });
  return `/auth/connect?${query}`;
}

export function googleConnection() {
  return process.env.AUTH0_GOOGLE_CONNECTION || "google-oauth2";
}

export async function insertEvent(token: string, action: CalendarAction, eventId: string) {
  const start = new Date(`${action.start}Z`);
  const end = new Date(start.getTime() + action.duration * 60_000);
  const response = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=none",
    {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        id: eventId,
        summary: action.title,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
      }),
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (response.status === 401 || response.status === 403) throw new CalendarConsentRequired();
  if (!response.ok) throw new Error(`Calendar insert status: ${response.status}`);
  const event = await response.json();
  if (event.id !== eventId) throw new Error("Calendar did not confirm the requested event");
  if (typeof event.htmlLink !== "string") return null;
  const url = URL.parse(event.htmlLink);
  if (url?.protocol === "https:" && (
    url.hostname === "calendar.google.com" ||
    (url.hostname === "www.google.com" && url.pathname.startsWith("/calendar/"))
  )) return url.href;
  return null;
}

export class CalendarConsentRequired extends Error {}
