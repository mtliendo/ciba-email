import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { openApproval, sealApproval, type PendingApproval } from "./approval";

const COOKIE = "ciba_calendar_request";

export async function currentApproval(owner: string) {
  return openApproval((await cookies()).get(COOKIE)?.value, owner);
}

export function sameOrigin(request: Request) {
  const base = process.env.APP_BASE_URL;
  return !!base && request.headers.get("origin") === new URL(base).origin;
}

export function approvalJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function setApproval(response: NextResponse, approval?: PendingApproval) {
  const value = approval ? sealApproval(approval) : "";
  response.cookies.set(COOKIE, value, {
    httpOnly: true,
    secure: process.env.APP_BASE_URL?.startsWith("https:"),
    sameSite: "lax",
    path: "/",
    // Keep the receipt briefly after the deadline so a returning tab can show expiry.
    ...(approval ? { expires: new Date(approval.expiresAt + 60_000) } : { maxAge: 0 }),
  });
  return response;
}
