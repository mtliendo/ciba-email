# CIBA email hello

Example Next.js app that shows how Auth0 CIBA works over email. Learning demo, not a product.

Flow: log in, type a binding message, click one button. The app POSTs /bc-authorize, Auth0 emails the authorizing user, you Accept, the app polls /oauth/token with the CIBA grant until tokens come back.

## What actually makes CIBA work

1. Confidential Regular Web App (client secret). Next.js login uses /auth/login and /auth/callback from @auth0/nextjs-auth0.
2. CIBA grant on that app, plus the email notification channel (not Guardian).
3. requested_expiry=600. Auth0 picks the channel from this number:
   - 300 seconds or less: Guardian push
   - 301 to 259200 seconds: email
4. login_hint is iss_sub, not a raw email. This demo authorizes admin@focusotter.com. If you log in as that user, we use the session sub. Otherwise set AUTH0_CIBA_SUB.
5. binding_message is the context on the review screen (the box under is requesting access). Required. Max 64 characters. Only letters, numbers, and +-_.,:#. No spaces. This app turns spaces into hyphens.
6. Authorizing user must have a verified email.

## Plan

CIBA is not on the Free plan.

- Minimum: Essentials plus the Auth0 for AI Agents add-on.
- B2C Essentials at 500 MAUs is 35 USD/month. The add-on is 50 percent of the base, rounded up, so 18 USD/month on that SKU.
- Guardian push CIBA is included on Enterprise. Email CIBA is the add-on on a paid plan.
- A new tenant gets a 22-day trial of most paid features. Email CIBA is a separate add-on SKU; confirm the CIBA email channel toggle is available before you count on the trial.
- Pricing: https://auth0.com/pricing

You only need one paid tenant. Reuse it for later demos.

## Dashboard setup

1. Applications > Applications > Create Application. Regular Web Application (the Next.js option is fine).
2. Let the Next.js quick start add callback and logout. Callback is localhost:3000/auth/callback. Logout and allowed origins are localhost:3000.
3. Settings: enable Client Initiated Backchannel Authentication (CIBA) and select the email channel. That is the CIBA-specific part.
4. Leave the default Auth0 email provider if this is not going to prod. Optional: Branding > Email Templates > Asynchronous Approval if you want to customize the mail.
5. Confirm admin@focusotter.com exists and the email is verified.
6. Copy env.example to .env.local. Set AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET, a random AUTH0_SECRET, and APP_BASE_URL.

## FAQ

### Why CIBA instead of just emailing a link with Resend?

Three people.

You are at dinner. Your Demo PM needs 30 minutes on your Google Calendar Thursday for a rehearsal. He does not have your Google. He tells your agent: book Focus Thursday 4 to 4:30, title Rehearsal.

The agent cannot write your calendar. It is not you. So it asks Auth0: I need a token for Focus, calendar write, message Rehearsal-Thu-4pm. Auth0 knows you as admin@focusotter.com. It emails you. The Demo PM is still in Slack. The agent is sitting there polling. You are the only one who got mail.

You tap Accept. That tap is you telling Auth0: yes, this app can write my calendar for that. Auth0 hands the agent an access token. The agent writes Thursday 4pm. The Demo PM never got your password, never got the token, never opened a browser as you. He only asked. The agent only acted after you said yes to Auth0. If you ignore the mail, he still has nothing, and your calendar is empty.

That is CIBA. I request, the agent waits, you authorize. The leftover is a token that says this user authorized this client.

### What does the poor-man's Resend version do?

Same scene, cheaper wire.

The Demo PM (or the agent) sends you mail through Resend: Approve rehearsal Thursday 4pm? with a button to yoursite.com/yes?ticket=abc. You click it. Your app marks ticket abc approved, then YOUR code calls Google with a Calendar key you already saved, or as a service account.

Auth0 never heard about it. The click proved someone who got that mail hit your URL. It did not prove Michael authorized this app to write his calendar right now. If the next step needs his Google access, you already had to be holding that token from some earlier login. The email did not mint one.

Same tap. Different leftover: a yes-row in your database vs an Auth0-issued access token. Use Resend when a yes/no in your database is enough. Use CIBA when the next call has to be as that user.
