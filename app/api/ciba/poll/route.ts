import { auth0 } from "@/lib/auth0";
import { advanceApproval } from "@/lib/approval";
import { approvalJson, currentApproval, sameOrigin, setApproval } from "@/lib/approval-http";
import { CalendarConsentRequired, googleConnection, insertEvent } from "@/lib/calendar";
import { pollCiba } from "@/lib/ciba";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return approvalJson({ detail: "Invalid request origin." }, 403);
  const session = await auth0.getSession();
  if (!session) return approvalJson({ detail: "Sign in to resume approval." }, 401);
  const approval = await currentApproval(session.user.sub);
  if (!approval) return approvalJson({ status: "expired", detail: "No pending request in this browser." });

  try {
    const { next, result } = await advanceApproval(approval, pollCiba, async (action, eventId) => {
      const grant = await auth0.getAccessTokenForConnection({ connection: googleConnection() }).catch(() => null);
      if (!grant) throw new CalendarConsentRequired();
      return insertEvent(grant.token, action, eventId);
    });
    const response = approvalJson(result);
    return next === approval ? response : setApproval(response, next);
  } catch (error) {
    const detail = error instanceof CalendarConsentRequired
      ? "Approved, but Google Calendar access is missing. Connect Google Calendar, then request a new approval."
      : "Could not confirm the Calendar event. Check your calendar before requesting another approval.";
    return setApproval(approvalJson({ status: "error", detail }, 502));
  }
}
