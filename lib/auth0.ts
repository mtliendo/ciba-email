import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { NextResponse } from "next/server";
import { CALENDAR_CONSENT_COOKIE, hasCalendarScope, sealCalendarConsent } from "./calendar-consent";

export const auth0 = new Auth0Client({
  enableAccessTokenEndpoint: false,
  enableConnectAccountEndpoint: true,
  async onCallback(error, context, session) {
    if (error) return new NextResponse("Auth0 could not complete the request. Return to the app and try again.", { status: 500 });
    const base = context.appBaseUrl;
    if (!base) return new NextResponse("Missing application URL.", { status: 500 });
    const home = new URL("/", base);
    const target = URL.parse(context.returnTo ?? "/", base);
    const response = NextResponse.redirect(target?.origin === home.origin ? target : home);
    const account = context.connectedAccount;
    const secret = process.env.AUTH0_SECRET;
    if (account && session && secret && hasCalendarScope(account)) {
      response.cookies.set(CALENDAR_CONSENT_COOKIE, sealCalendarConsent(session, secret), {
        httpOnly: true,
        secure: home.protocol === "https:",
        sameSite: "lax",
        path: "/",
      });
    }
    return response;
  },
  authorizationParameters: {
    ...(process.env.AUTH0_LOGIN_CONNECTION ? { connection: process.env.AUTH0_LOGIN_CONNECTION } : {}),
    scope: "openid profile email offline_access",
  },
});
