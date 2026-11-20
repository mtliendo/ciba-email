import assert from "node:assert/strict";
import { test } from "node:test";
import { advanceApproval, openApproval, pendingStatus, sealApproval, type PendingApproval } from "./approval.ts";
import { calendarBindingMessage, parseCalendarAction } from "./binding-message.ts";

const now = Date.parse("2030-03-29T15:00:00Z");
const approval: PendingApproval = {
  owner: "auth0|alice",
  authReqId: "provider-request",
  eventId: "abcdabcd280647dbb1ec2a0e348d4e7a",
  action: { title: "Demo rehearsal", start: "2030-03-29T16:00", duration: 30 },
  expiresAt: now + 600_000,
  pollAt: now,
  interval: 5,
};

test("validates UTC date, title and duration without accepting provider or recipient overrides", () => {
  assert.deepEqual(parseCalendarAction({ ...approval.action, sub: "auth0|bob", calendarId: "other" }, now), approval.action);
  for (const input of [
    null,
    { ...approval.action, start: "2030-02-31T16:00" },
    { ...approval.action, start: "2030-03-29T14:00" },
    { ...approval.action, start: "2030-03-29T16:00+00:00" },
    { ...approval.action, title: "Look <script>" },
    { ...approval.action, title: "x".repeat(21) },
    { ...approval.action, duration: 45 },
  ]) assert.equal(parseCalendarAction(input, now), null);
});

test("the email binding covers the event, UTC time, duration and unique reference within Auth0's limit", () => {
  const message = calendarBindingMessage({ ...approval.action, title: "Event with 20 chars", duration: 60 }, "abcdabcd");
  assert.match(message, /^Calendar:Add:2030-03-29T16:00Z:60m:Event-with-20-chars:abcdabcd$/);
  assert.equal(calendarBindingMessage({ ...approval.action, title: "x".repeat(20) }, "abcdabcd").length, 64);
});

test("the browser can resume a sealed request only for its owner; no raw request ID is returned", () => {
  process.env.AUTH0_SECRET = "a".repeat(64);
  const sealed = sealApproval(approval);
  assert.deepEqual(openApproval(sealed, approval.owner), approval);
  assert.equal(openApproval(sealed, "auth0|bob"), null);
  const bytes = Buffer.from(sealed, "base64url");
  bytes[32] ^= 1;
  assert.equal(openApproval(bytes.toString("base64url"), approval.owner), null);
  assert.equal(JSON.stringify(pendingStatus(approval, now)).includes(approval.authReqId), false);
});

test("never polls too soon or performs a Calendar write before approval", async () => {
  const forbid = async () => assert.fail("Unexpected network operation");
  const early = await advanceApproval({ ...approval, pollAt: now + 3000 }, forbid, forbid, () => now);
  assert.equal(early.result.status === "pending" && early.result.pollAfter, 3000);
  const pending = await advanceApproval(approval, async () => "pending", forbid, () => now);
  assert.equal(pending.result.status, "pending");
  assert.equal(pending.next?.pollAt, now + 5000);
  const slow = await advanceApproval(approval, async () => "slow_down", forbid, () => now);
  assert.equal(slow.next?.pollAt, now + 10_000);
  assert.equal((await advanceApproval(approval, async () => "denied", forbid, () => now)).result.status, "denied");
  assert.equal((await advanceApproval(approval, async () => "expired", forbid, () => now)).result.status, "expired");
  assert.equal((await advanceApproval(approval, forbid, forbid, () => approval.expiresAt)).result.status, "expired");
});

test("a successful poll creates only the original authorized event and returns the receipt", async () => {
  const calls: string[] = [];
  const result = await advanceApproval(approval, async (authReqId) => {
    assert.equal(authReqId, approval.authReqId);
    calls.push("approve");
    return "approved";
  }, async (action, eventId) => {
    assert.deepEqual(action, approval.action);
    assert.equal(eventId, approval.eventId);
    calls.push("create");
    return "https://calendar.google.com/calendar/event";
  }, () => now);
  assert.deepEqual(calls, ["approve", "create"]);
  assert.deepEqual(result, { result: { status: "created", link: "https://calendar.google.com/calendar/event" } });
});

test("does not create an event if it started while approval was pending", async () => {
  const result = await advanceApproval(
    { ...approval, action: { ...approval.action, start: "2030-03-29T15:00" } },
    async () => "approved",
    async () => assert.fail("Unexpected Calendar write"),
    () => now,
  );
  assert.equal(result.result.status, "expired");
});
