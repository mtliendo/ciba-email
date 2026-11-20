import { auth0 } from "@/lib/auth0";
import { cookies } from "next/headers";
import { currentApproval } from "@/lib/approval-http";
import { pendingStatus } from "@/lib/approval";
import { linkGoogleCalendar } from "@/lib/calendar";
import { CALENDAR_CONSENT_COOKIE, verifiedCalendarConsent } from "@/lib/calendar-consent";
import { CibaButton } from "./ciba-button";

export default async function Home() {
  const session = await auth0.getSession();
  const pending = session ? await currentApproval(session.user.sub) : null;
  const canRequest = session?.user.email_verified === true && !!session.tokenSet.refreshToken;
  const secret = process.env.AUTH0_SECRET;
  const justConnected = session && canRequest && secret && verifiedCalendarConsent(
    (await cookies()).get(CALENDAR_CONSENT_COOKIE)?.value,
    session.user.sub,
    secret,
  );

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10 sm:px-8 sm:py-16">
      <header className="mb-9 border-b border-emerald-950/15 pb-7">
        <div className="mb-5 flex items-center justify-between gap-4">
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-950">
            Auth0 demo · Email CIBA
          </span>
          {session ? <a href="/auth/logout" className="text-sm font-medium underline">Sign out</a> : null}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-emerald-950 sm:text-5xl">
          Approve a Calendar event by email
        </h1>
        <p className="mt-4 max-w-lg text-base leading-relaxed text-stone-700">
          Plan an event here and approve it from your inbox. Only then does the app use Auth0 Token Vault to add it to your primary Google Calendar.
        </p>
      </header>
      {!session ? (
        <a href="/auth/login" className="inline-block rounded-lg bg-emerald-900 px-5 py-3 font-semibold text-white hover:bg-emerald-950">
          Sign in to start
        </a>
      ) : !canRequest ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          {session.user.email_verified !== true
            ? "Verify your email with Auth0 before requesting an approval."
            : "Offline access is missing. Enable it for this app, then sign out and sign in again."}
        </p>
      ) : (
        <>
          <section className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-5">
            <div>
              <h2 className="font-semibold text-emerald-950">1. Connect your calendar</h2>
              {justConnected
                ? <p role="status" className="mt-1 text-sm font-medium text-emerald-800">Google Calendar connected</p>
                : <p className="mt-1 text-sm text-stone-600">Grant Calendar access before requesting approval.</p>}
            </div>
            <a href={linkGoogleCalendar()} className="rounded-lg border border-emerald-800 px-3 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-50">
              {justConnected ? "Reconnect Google Calendar" : "Connect Google Calendar"}
            </a>
          </section>
          <CibaButton
            email={typeof session.user.email === "string" ? session.user.email : ""}
            initialStatus={pending ? pendingStatus(pending) : null}
            hostedReview={!!process.env.AUTH0_CIBA_REVIEW_AUDIENCE}
          />
        </>
      )}
    </main>
  );
}
