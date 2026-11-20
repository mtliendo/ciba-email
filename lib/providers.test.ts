import assert from "node:assert/strict";
import { test } from "node:test";
import { exchangeConnectionToken, pollCiba, startCiba } from "./ciba.ts";
import { CalendarConsentRequired, insertEvent } from "./calendar.ts";

test("CIBA requests bind the session subject and use email expiry and the CIBA grant", async (t) => {
  Object.assign(process.env, {
    AUTH0_DOMAIN: "example.auth0.com",
    AUTH0_CLIENT_ID: "demo-client",
    AUTH0_CLIENT_SECRET: "fixture-not-a-secret",
  });
  let polls = 0;
  t.mock.method(globalThis, "fetch", async (url: URL, request: RequestInit) => {
    const params = request.body as URLSearchParams;
    assert.equal(url.origin, "https://example.auth0.com");
    assert.equal(params.get("client_id"), "demo-client");
    if (url.pathname === "/bc-authorize") {
      assert.deepEqual(JSON.parse(params.get("login_hint")!), { format: "iss_sub", iss: url.origin + "/", sub: "auth0|alice" });
      assert.equal(params.get("requested_expiry"), "600");
      assert.equal(params.get("binding_message"), "Calendar:Add:2030-03-29T16:00Z:30m:Rehearsal:abcdabcd");
      return Response.json({ auth_req_id: "request-id", interval: 7, expires_in: 430 });
    }
    assert.equal(url.pathname, "/oauth/token");
    assert.equal(params.get("grant_type"), "urn:openid:params:grant-type:ciba");
    assert.equal(params.get("auth_req_id"), "request-id");
    return ++polls === 1
      ? Response.json({ error: "authorization_pending" }, { status: 400 })
      : Response.json({ access_token: "never-return-to-the-browser" });
  });
  const started = await startCiba("auth0|alice", "Calendar:Add:2030-03-29T16:00Z:30m:Rehearsal:abcdabcd");
  assert.deepEqual(started, { authReqId: "request-id", interval: 7, expiresIn: 430 });
  assert.equal(await pollCiba(started.authReqId), "pending");
  assert.equal(await pollCiba(started.authReqId), "approved");
});

test("each approved write exchanges the session refresh token rather than reusing a revoked Google token", async (t) => {
  Object.assign(process.env, {
    AUTH0_DOMAIN: "example.auth0.com",
    AUTH0_CLIENT_ID: "demo-client",
    AUTH0_CLIENT_SECRET: "fixture-not-a-secret",
  });
  let reply = Response.json({ access_token: "original-token" });
  t.mock.method(globalThis, "fetch", async (url: URL, init: RequestInit) => {
    assert.equal(url.href, "https://example.auth0.com/oauth/token");
    assert.equal(init.method, "POST");
    assert.deepEqual(Object.fromEntries(init.body as URLSearchParams), {
      client_id: "demo-client",
      client_secret: "fixture-not-a-secret",
      grant_type: "urn:auth0:params:oauth:grant-type:token-exchange:federated-connection-access-token",
      subject_token_type: "urn:ietf:params:oauth:token-type:refresh_token",
      subject_token: "session-refresh-token",
      requested_token_type: "http://auth0.com/oauth/token-type/federated-connection-access-token",
      connection: "google-calendar",
    });
    return reply;
  });
  const exchange = () => exchangeConnectionToken("google-calendar", "session-refresh-token");
  assert.equal(await exchange(), "original-token");
  reply = Response.json({ error: "invalid_grant" }, { status: 400 });
  assert.equal(await exchange(), null);
  reply = Response.json({ access_token: "reconnected-token" });
  assert.equal(await exchange(), "reconnected-token");
});

test("Calendar insert only uses the primary calendar, UTC event times and a stable ID", async (t) => {
  const action = { title: "Demo rehearsal", start: "2030-03-29T23:45", duration: 30 } as const;
  const id = "abcdabcd280647dbb1ec2a0e348d4e7a";
  const link = "https://www.google.com/calendar/event?eid=fixture";
  let reply = Response.json({ id, htmlLink: link });
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.equal(url, "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=none");
    assert.equal(new Headers(init.headers).get("Authorization"), "Bearer fixture-access-token");
    assert.deepEqual(JSON.parse(String(init.body)), {
      id,
      summary: action.title,
      start: { dateTime: "2030-03-29T23:45:00.000Z" },
      end: { dateTime: "2030-03-30T00:15:00.000Z" },
    });
    return reply;
  });
  assert.equal(await insertEvent("fixture-access-token", action, id), link);
  reply = Response.json({ id, htmlLink: "https://not-calendar.test/event" });
  assert.equal(await insertEvent("fixture-access-token", action, id), null);
  reply = Response.json({ error: "insufficientPermissions" }, { status: 403 });
  await assert.rejects(insertEvent("fixture-access-token", action, id), CalendarConsentRequired);
});
