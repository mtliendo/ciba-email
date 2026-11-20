"use client";

import { useEffect, useState, type FormEvent } from "react";
import { DURATIONS, TITLE_MAX } from "@/lib/binding-message";
import type { ApprovalStatus } from "@/lib/approval";

type Props = {
  email: string;
  initialStatus: ApprovalStatus | null;
};

export function CibaButton({ email, initialStatus }: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [sending, setSending] = useState(false);
  const pending = status?.status === "pending" ? status : null;
  const busy = sending || !!pending;

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
  }, [pending]);

  async function sendApproval(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    setSending(true);
    setStatus(null);
    try {
      const response = await fetch("/api/ciba/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.get("title"),
          start: data.get("start"),
          duration: Number(data.get("duration")),
        }),
      });
      const result = await response.json();
      setStatus(response.ok ? result : { status: "error", detail: result.detail });
    } catch {
      setStatus({ status: "error", detail: "Could not reach the app. Reload this page to check for a pending request." });
    } finally {
      setSending(false);
    }
  }

  const control = "rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-950 disabled:bg-stone-100";

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-emerald-950">2. Request email approval</h2>
      <p className="mt-1 break-all text-sm text-stone-600">Auth0 sends the request to {email}.</p>
      <form onSubmit={sendApproval} className="mt-5 grid gap-4">
        <label className="grid gap-1 text-sm font-medium">
          Event title
          <input
            name="title" className={control} required maxLength={TITLE_MAX}
            placeholder="Demo rehearsal" disabled={busy} defaultValue={pending?.action.title}
            aria-describedby="title-help"
          />
          <span id="title-help" className="text-xs font-normal text-stone-600">
            Up to {TITLE_MAX} characters. Start with a letter or number; use English letters, digits, spaces or + - _ . , : #.
          </span>
        </label>
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <label className="grid min-w-0 gap-1 text-sm font-medium">
            Start (UTC)
            <input name="start" type="datetime-local" required className={control} disabled={busy} defaultValue={pending?.action.start} />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Duration
            <select name="duration" className={control} disabled={busy} defaultValue={pending?.action.duration ?? 30}>
              {DURATIONS.map((duration) => <option key={duration} value={duration}>{duration} minutes</option>)}
            </select>
          </label>
        </div>
        <button type="submit" disabled={busy} className="w-fit rounded-lg bg-emerald-900 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-950 disabled:cursor-not-allowed disabled:opacity-60">
          {sending ? "Sending approval email…" : pending ? "Waiting for approval…" : "Request email approval"}
        </button>
      </form>
      <div role="status" aria-live="polite">
        {pending ? (
          <div className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-semibold">Waiting for email approval</p>
            <p className="mt-1">Check your inbox and compare the request below before approving. Nothing has been added yet.</p>
            <p className="mt-2 font-mono text-xs break-all">{pending.bindingMessage}</p>
          </div>
        ) : status?.status === "created" ? (
          <div className="mt-5 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950">
            <p className="font-semibold">Approved · Event created</p>
            {status.link ? <a href={status.link} target="_blank" rel="noreferrer" className="mt-1 inline-block underline">Open in Google Calendar</a> : null}
          </div>
        ) : status ? (
          <div className="mt-5 rounded-lg border border-stone-300 bg-stone-50 p-4 text-sm text-stone-800">
            <p className="font-semibold">{status.status === "denied" ? "Approval declined" : status.status === "expired" ? "Approval expired" : "Could not complete the request"}</p>
            <p className="mt-1">{status.detail}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
