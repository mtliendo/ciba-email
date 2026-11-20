"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { DURATIONS, TITLE_MAX, parseCalendarAction, type CalendarAction } from "@/lib/binding-message";
import { localStartToUtc } from "@/lib/local-start";
import type { ApprovalStatus } from "@/lib/approval";

type Props = {
  email: string;
  initialStatus: ApprovalStatus | null;
  hostedReview: boolean;
};

const subscribeToTimeZone = () => () => {};
const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const serverTimeZone = () => "";
const primaryButton = "w-fit rounded-lg bg-emerald-900 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-950 disabled:cursor-not-allowed disabled:opacity-60";

function EventDetails({ action, timeZone }: { action: CalendarAction; timeZone: string }) {
  const date = new Date(`${action.start}Z`);
  const localStart = timeZone && date.toLocaleString(undefined, {
    timeZone, dateStyle: "medium", timeStyle: "long",
  });
  return (
    <dl className="mt-3 grid gap-2">
      <div><dt className="inline font-semibold">Event: </dt><dd className="inline">{action.title}</dd></div>
      <div>
        <dt className="inline font-semibold">Start: </dt>
        <dd className="inline">
          {localStart ? <>{localStart} <span className="whitespace-nowrap">({action.start.replace("T", " ")} UTC)</span></> : `${action.start.replace("T", " ")} UTC`}
        </dd>
      </div>
      <div><dt className="inline font-semibold">Duration: </dt><dd className="inline">{action.duration} minutes</dd></div>
    </dl>
  );
}

export function CibaButton({ email, initialStatus, hostedReview }: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [draft, setDraft] = useState<CalendarAction | null>(null);
  const [sending, setSending] = useState(false);
  const router = useRouter();
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const startInput = useRef<HTMLInputElement>(null);
  const timeZone = useSyncExternalStore(subscribeToTimeZone, browserTimeZone, serverTimeZone);
  const pending = status?.status === "pending" ? status : null;
  const busy = sending || !!pending;

  useEffect(() => {
    if (draft) reviewHeading.current?.focus();
  }, [draft]);

  useEffect(() => {
    if (!pending) return;
    const controller = new AbortController();
    const wait = Math.min(pending.pollAfter, Math.max(0, pending.expiresAt - Date.now()));
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/ciba/poll", { method: "POST", signal: controller.signal });
        const result = await response.json();
        if (!controller.signal.aborted) {
          setStatus(response.ok ? result : { status: "error", detail: result.detail });
          if (!response.ok && result.reconnect === true) router.refresh();
        }
      } catch {
        if (!controller.signal.aborted) {
          setStatus({ status: "error", detail: "Connection lost. Reload this page to check or resume the request." });
        }
      }
    }, wait);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [pending, router]);

  function reviewEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const start = localStartToUtc(data.get("start"));
    const action = start && parseCalendarAction({
      title: data.get("title"),
      start,
      duration: Number(data.get("duration")),
    });
    if (!action) {
      setStatus({
        status: "error",
        detail: start
          ? "Enter a valid title, future start time and duration."
          : "Choose a valid local start time outside a skipped or repeated daylight-saving hour.",
      });
      return;
    }
    setStatus(null);
    setDraft(action);
  }

  async function sendApproval() {
    if (busy || !draft) return;
    setSending(true);
    try {
      const response = await fetch("/api/ciba/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const result = await response.json();
      setStatus(response.ok ? result : { status: "error", detail: result.detail });
    } catch {
      setStatus({ status: "error", detail: "Could not reach the app. Reload this page to check for a pending request." });
    } finally {
      setDraft(null);
      setSending(false);
    }
  }

  const control = "rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-950 disabled:bg-stone-100";

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-emerald-950">2. Request email approval</h2>
      <p className="mt-1 break-all text-sm text-stone-600">Auth0 sends the request to {email}.</p>
      <form onSubmit={reviewEvent} className={draft || pending ? "hidden" : "mt-5 grid gap-4"}>
        <label className="grid gap-1 text-sm font-medium">
          Event title
          <input
            name="title" className={control} required maxLength={TITLE_MAX}
            placeholder="Demo rehearsal" disabled={busy}
            aria-describedby="title-help"
          />
          <span id="title-help" className="text-xs font-normal text-stone-600">
            Up to {TITLE_MAX} characters. Start with a letter or number; use English letters, digits, spaces or + - _ . , : #.
          </span>
        </label>
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <label className="grid min-w-0 gap-1 text-sm font-medium">
            Start time
            <input ref={startInput} name="start" type="datetime-local" required className={control} disabled={busy} aria-describedby="start-help" />
            <span id="start-help" className="text-xs font-normal text-stone-600">
              Your local time{timeZone ? ` (${timeZone})` : ""}. The email uses UTC.
            </span>
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Duration
            <select name="duration" className={control} disabled={busy} defaultValue={30}>
              {DURATIONS.map((duration) => <option key={duration} value={duration}>{duration} minutes</option>)}
            </select>
          </label>
        </div>
        <button type="submit" disabled={busy} className={primaryButton}>Review event</button>
      </form>
      {draft ? (
        <section aria-labelledby="event-review" className="mt-5 rounded-lg border border-stone-300 bg-stone-50 p-4 text-sm text-stone-800">
          <h3 id="event-review" tabIndex={-1} ref={reviewHeading} className="font-semibold">Review your event</h3>
          <EventDetails action={draft} timeZone={timeZone} />
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <button type="button" onClick={sendApproval} disabled={busy} className={primaryButton}>
              {sending ? "Sending approval email…" : "Request email approval"}
            </button>
            <button type="button" disabled={busy} onClick={() => {
              setDraft(null);
              requestAnimationFrame(() => startInput.current?.focus());
            }} className="font-medium underline disabled:opacity-60">Edit event</button>
          </div>
        </section>
      ) : null}
      <div role="status" aria-live="polite">
        {pending ? (
          <div className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-semibold">Waiting for email approval</p>
            <EventDetails action={pending.action} timeZone={timeZone} />
            <p className="mt-3">
              {hostedReview
                ? "Compare these details with the email and Auth0 review page before approving."
                : "Compare these details with the request code in your email. The default Auth0 screen only asks you to accept or decline."}
              {" Nothing has been added yet."}
            </p>
            <p className="mt-2 font-mono text-xs break-all">{pending.bindingMessage}</p>
          </div>
        ) : status?.status === "created" ? (
          <div className="mt-5 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950">
            <p className="font-semibold">Approved · Event created</p>
            {status.link ? <a href={status.link} target="_blank" rel="noreferrer" className="mt-1 inline-block underline">Open in Google Calendar</a> : null}
          </div>
        ) : status && "detail" in status ? (
          <div className="mt-5 rounded-lg border border-stone-300 bg-stone-50 p-4 text-sm text-stone-800">
            <p className="font-semibold">{status.status === "denied" ? "Approval declined" : status.status === "expired" ? "Approval expired" : "Could not complete the request"}</p>
            <p className="mt-1">{status.detail}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
