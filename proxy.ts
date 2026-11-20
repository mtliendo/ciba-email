import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { CALENDAR_CONSENT_COOKIE } from "@/lib/calendar-consent";

export async function proxy(request: Request) {
  const { pathname } = new URL(request.url);
  if (pathname.startsWith("/auth")) {
    const response = await auth0.middleware(request);
    if (pathname === "/auth/logout") response.cookies.delete(CALENDAR_CONSENT_COOKIE);
    return response;
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/auth/:path*"],
};
