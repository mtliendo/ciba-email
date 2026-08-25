import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";

export async function proxy(request: Request) {
  const { pathname } = new URL(request.url);
  if (pathname.startsWith("/auth")) {
    return auth0.middleware(request);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/auth/:path*"],
};
