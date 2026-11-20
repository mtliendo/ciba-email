import assert from "node:assert/strict";
import { test } from "node:test";
import { CALENDAR_SCOPE, googleConnection } from "./calendar.ts";
import { CALENDAR_CONSENT_SECONDS, hasCalendarScope, sealCalendarConsent, verifiedCalendarConsent } from "./calendar-consent.ts";
import { localStartToUtc } from "./local-start.ts";

test("only the configured Google connection with Calendar scope confirms consent", () => {
  assert.ok(hasCalendarScope({ connection: googleConnection(), scopes: [CALENDAR_SCOPE] }));
  assert.ok(!hasCalendarScope({ connection: "a-different-connection", scopes: [CALENDAR_SCOPE] }));
  assert.ok(!hasCalendarScope({ connection: googleConnection(), scopes: ["openid"] }));
  assert.ok(!hasCalendarScope({ connection: googleConnection() }));
});

test("consent feedback is short-lived, owner-bound and signed", () => {
  const now = Date.parse("2030-01-01T00:00Z");
  const secret = "fixture-not-a-secret";
  const receipt = sealCalendarConsent("alice", secret, now);
  const expires = now + CALENDAR_CONSENT_SECONDS * 1000;
  assert.ok(verifiedCalendarConsent(receipt, "alice", secret, expires - 1));
  assert.ok(!verifiedCalendarConsent(receipt, "alice", secret, expires));
  assert.ok(!verifiedCalendarConsent(receipt, "bob", secret, now));
  assert.ok(!verifiedCalendarConsent(receipt, "alice", "wrong-secret", now));
  assert.ok(!verifiedCalendarConsent(receipt.replace(String(expires), String(expires + 1000)), "alice", secret, now));
  assert.ok(!verifiedCalendarConsent("connected", "alice", secret, now));
});

test("local time converts with the event date's offset and rejects ambiguous or nonexistent times", () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = "America/New_York";
    assert.equal(localStartToUtc("2030-01-15T08:00"), "2030-01-15T13:00");
    assert.equal(localStartToUtc("2030-07-15T20:00"), "2030-07-16T00:00");
    assert.equal(localStartToUtc("2030-03-10T02:30"), null);
    assert.equal(localStartToUtc("2030-11-03T01:30"), null);
    assert.equal(localStartToUtc("2030-11-03T00:30"), "2030-11-03T04:30");
    assert.equal(localStartToUtc("2030-11-03T02:30"), "2030-11-03T07:30");
    assert.equal(localStartToUtc("2030-02-30T08:00"), null);
    assert.equal(localStartToUtc("2030-01-15T08:00Z"), null);
    process.env.TZ = "Asia/Kathmandu";
    assert.equal(localStartToUtc("2030-05-04T04:30"), "2030-05-03T22:45");
    process.env.TZ = "Australia/Lord_Howe";
    assert.equal(localStartToUtc("2030-04-07T01:45"), null);
    assert.equal(localStartToUtc("2030-10-06T02:15"), null);
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});
