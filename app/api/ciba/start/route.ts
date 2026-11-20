import { randomUUID } from "node:crypto";
import { auth0 } from "@/lib/auth0";
import { approvalJson, currentApproval, sameOrigin, setApproval } from "@/lib/approval-http";
import { pendingStatus } from "@/lib/approval";
import { parseCalendarAction } from "@/lib/binding-message";
import { startCiba } from "@/lib/ciba";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return approvalJson({ detail: "Invalid request origin." }, 403);
  const session = await auth0.getSession();
  if (!session) return approvalJson({ detail: "Sign in to request approval." }, 401);
  if (session.user.email_verified !== true || typeof session.user.email !== "string") {
    return approvalJson({ detail: "Sign in with a verified email address." }, 403);
  }
  if (!session.tokenSet.refreshToken) {
    return approvalJson({ detail: "Sign out and back in with offline access enabled." }, 403);
  }

  const existing = await currentApproval(session.user.sub);
  if (existing && Date.now() < existing.expiresAt) return approvalJson(pendingStatus(existing));
  const action = parseCalendarAction(await request.json().catch(() => null));
  if (!action) return approvalJson({ detail: "Enter a valid title, future start time and duration." }, 400);

  try {
    const eventId = randomUUID().replaceAll("-", "");
    const now = Date.now();
    const ciba = await startCiba(session.user.sub, action, eventId.slice(0, 8));
    const approval = {
      owner: session.user.sub,
      authReqId: ciba.authReqId,
      action,
      eventId,
      interval: ciba.interval,
      expiresAt: now + ciba.expiresIn * 1000,
      pollAt: Date.now() + ciba.interval * 1000,
    };
    return setApproval(approvalJson(pendingStatus(approval), 201), approval);
  } catch {
    return approvalJson({ detail: "Could not request email approval. Check the Auth0 CIBA configuration and try again." }, 502);
  }
}
