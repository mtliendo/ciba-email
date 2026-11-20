import { createHmac, timingSafeEqual } from "node:crypto";
import { CALENDAR_SCOPE, googleConnection } from "./calendar.ts";

export const CALENDAR_CONSENT_COOKIE = "ciba_calendar_consent";

type CalendarConsentSession = {
  user: { sub: string };
  internal: { sid: string; createdAt: number };
};

export function hasCalendarScope(account: { connection: string; scopes?: string[] }) {
  return account.connection === googleConnection() && Array.isArray(account.scopes) && account.scopes.includes(CALENDAR_SCOPE);
}

export function sealCalendarConsent(session: CalendarConsentSession, secret: string) {
  return createHmac("sha256", secret)
    .update(JSON.stringify([
      CALENDAR_CONSENT_COOKIE, session.user.sub, session.internal.sid,
      session.internal.createdAt, googleConnection(),
    ]))
    .digest("base64url");
}

export function verifiedCalendarConsent(value: string | undefined, session: CalendarConsentSession, secret: string) {
  return !!value && /^[A-Za-z0-9_-]{43}$/.test(value)
    && timingSafeEqual(Buffer.from(value), Buffer.from(sealCalendarConsent(session, secret)));
}
