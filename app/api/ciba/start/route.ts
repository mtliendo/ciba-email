import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { resolveCibaUserSub, startCiba } from "@/lib/ciba";

export async function POST(request: Request) {
  const session = await auth0.getSession();
  if (!session) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    bindingMessage?: string;
  };

  try {
    const sub = await resolveCibaUserSub(
      session.user.sub,
      typeof session.user.email === "string" ? session.user.email : undefined,
    );
    const started = await startCiba(sub, body.bindingMessage ?? "Approve-this-action");
    return NextResponse.json(started);
  } catch (error) {
    const message = error instanceof Error ? error.message : "start failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
