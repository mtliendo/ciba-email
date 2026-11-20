import { createHmac, timingSafeEqual } from "node:crypto";
import { CALENDAR_SCOPE, googleConnection } from "./calendar.ts";

export const CALENDAR_CONSENT_COOKIE = "ciba_calendar_consent";
export const CALENDAR_CONSENT_SECONDS = 120;

export function hasCalendarScope(account: { connection: string; scopes?: string[] }) {
  return account.connection === googleConnection() && Array.isArray(account.scopes) && account.scopes.includes(CALENDAR_SCOPE);
}

function signature(owner: string, expires: number, secret: string) {
  return createHmac("sha256", secret)
    .update(JSON.stringify([CALENDAR_CONSENT_COOKIE, owner, googleConnection(), expires]))
    .digest("base64url");
}

export function sealCalendarConsent(owner: string, secret: string, now = Date.now()) {
  const expires = now + CALENDAR_CONSENT_SECONDS * 1000;
  return `${expires}.${signature(owner, expires, secret)}`;
}

export function verifiedCalendarConsent(value: string | undefined, owner: string, secret: string, now = Date.now()) {
  const match = value?.match(/^(\d{1,15})\.([A-Za-z0-9_-]{43})$/);
  if (!match) return false;
  const expires = Number(match[1]);
  return expires > now && timingSafeEqual(Buffer.from(match[2]), Buffer.from(signature(owner, expires, secret)));
}
