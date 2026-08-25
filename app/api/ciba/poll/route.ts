import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { pollCiba } from "@/lib/ciba";

export async function POST(request: Request) {
  const session = await auth0.getSession();
  if (!session) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const { authReqId } = (await request.json()) as { authReqId?: string };
  if (!authReqId) {
    return NextResponse.json({ error: "authReqId required" }, { status: 400 });
  }

  try {
    const result = await pollCiba(authReqId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "poll failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
