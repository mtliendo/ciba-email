# Email approval for Google Calendar

An Auth0 learning demo: draft an event, approve it in your inbox with CIBA, and let the app use Token Vault to write to your primary Google Calendar. Unlike the [Google Token Vault sample](https://github.com/focusOtter/google-token-vault), this demo adds a one-time approval before a write. It uses no LLM and sends no meeting invitations.

**Topics:** auth0, ciba, asynchronous-approval, token-vault, google-calendar, nextjs

![Architecture: the browser requests email approval from Auth0; the Next.js server waits for approval before retrieving a Google token and creating the event.](docs/architecture.svg)

## Run locally

Use Node 24 and pnpm. Copy `.env.example` to `.env.local` and fill in the values. Generate `AUTH0_SECRET` with `openssl rand -hex 32`.

1. Create a **Regular Web Application** with a client secret (Post) on a tenant that supports CIBA email and Token Vault. Allow `http://localhost:3000/auth/callback` as a callback; allow `http://localhost:3000` for logout and web origins.
2. Enable Authorization Code, Refresh Token, CIBA (`urn:openid:params:grant-type:ciba`) and Token Vault (`urn:auth0:params:oauth:grant-type:token-exchange:federated-connection-access-token`). Enable **email** as a CIBA notification channel. The app requests 600 seconds: Auth0 uses email for requests over 300 seconds when enabled. Use Auth0's built-in email provider for testing; production needs a configured provider and Asynchronous Approval template.
3. Under your app's API access, authorize the Auth0 My Account API with `create:me:connected_accounts`. Use a non-rotating, time-limited refresh token and a Multi-Resource Refresh Token policy for the tenant's `https://YOUR_AUTH0_DOMAIN/me/` audience with that scope. Sign in again after changing grants.
4. Use a Google OAuth web client with the **Calendar API** enabled. Add your test user to the Google consent screen and allow the Google callback displayed by Auth0 (usually `https://YOUR_AUTH0_DOMAIN/login/callback`). Configure a Google social connection for **Connected Accounts / Token Vault**, allow offline access and `https://www.googleapis.com/auth/calendar.events.owned`, and enable the connection on this app. Set `AUTH0_GOOGLE_CONNECTION` to its name. Do not add write scopes to Orbit's or another demo's shared connection.
5. Enable a login connection. Sign in using a verified email address you can access. The signed-in Auth0 subject is the approver; this demo never redirects approval to an arbitrary email or tenant-wide demo account.

See [Auth0 CIBA app configuration](https://auth0.com/docs/get-started/applications/configure-client-initiated-backchannel-authentication), [Token Vault configuration](https://auth0.com/docs/secure/call-apis-on-users-behalf/token-vault/configure-token-vault) and the [Google Token Vault setup guide](https://docs.google.com/document/d/1K1GCk2OE8vrYr_nVa2ut4Zlzv-ME5Unuqyf2UFj7we4/edit) for details.

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

## Try the approval

1. Click **Connect Google Calendar**, allow Calendar access, and return to the **Google Calendar connected** confirmation. The app remembers successful consent for the current browser login without fetching a Google token before approval. If a write fails because Calendar access is missing, reconnect and request a new approval.
2. Enter an event title, future start in your browser's local time, and duration. Click **Review event** to check the local and UTC times before sending. Times that are skipped or occur twice during a clock change are rejected.
3. Click **Request email approval**, then compare the pending event and request code with the delivered email before approving. Auth0's default review screen only shows Accept and Decline; to show the event on that screen, follow the optional setup below.
4. Return to the app and wait for **Approved · Event created**, then open the event in Google Calendar. Repeat with **Decline** or let the request time out; neither should create an event.

### Optional: show the event on Auth0's hosted review screen

This requires a verified Auth0 custom domain and a Universal Login page template that supports prompt partials. Leave `AUTH0_CIBA_REVIEW_AUDIENCE` unset on the default tenant domain. The review in the app and the event binding in the email still work without it.

1. On the tenant, register a dedicated [Rich Authorization Requests](https://auth0.com/docs/get-started/apis/configure-rich-authorization-requests) API that accepts the `ciba_email_calendar_event` authorization details type. Set user access to require a client grant and authorize only the demo app to request that type. No Calendar scopes or Google tokens belong on this API.
2. Add the [Calendar Liquid snippet](docs/auth0-calendar-review.liquid) to the `form-content` slot of the `customized-consent` screen using [Auth0 prompt partials](https://auth0.com/docs/get-started/apis/configure-rich-authorization-requests#set-customized-consent-prompt). This is a tenant-level setting: preserve existing slots and any content already in that slot. Keep the type guard so other consent screens are unchanged.
3. Set `AUTH0_CIBA_REVIEW_AUDIENCE` to the API Identifier. Use the verified custom domain for `AUTH0_DOMAIN` and configure the Google connection's OAuth redirect for that domain. Send a test approval and verify the hosted screen shows the event title, UTC start, duration, and reference before enabling this for users. Auth0's Accept/Decline buttons remain the only way to decide the CIBA request.

## What the demo verifies

- The server binds the event details and Auth0 request ID in a short-lived, encrypted HTTP-only cookie. Refreshing in the same browser resumes polling; closing the tab pauses it. This is not a durable background queue.
- Polling uses the provider interval and backs off on `slow_down`. No Calendar write runs until Auth0 approves. There is no route that accepts an event payload after approval.
- CIBA verifies consent for the event; it does **not** mint the Google token. For each approved event the server exchanges the same user's Auth0 refresh token through Token Vault, without reusing a Google token from the session cache after reconnection. The Calendar API handles the connected account's Google permissions.
- Auth0's CIBA response is single-use, and the Calendar write includes a stable event ID. If the app cannot confirm the write, it doesn't retry automatically. Check Calendar before making a new request.

```sh
corepack pnpm test
corepack pnpm lint
corepack pnpm build
```
