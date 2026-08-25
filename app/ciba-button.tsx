"use client";

import { useState } from "react";

type Status = "idle" | "sending" | "pending" | "approved" | "denied" | "error";

export function CibaButton() {
  const [status, setStatus] = useState<Status>("idle");
  const [detail, setDetail] = useState("");
  const [bindingMessage, setBindingMessage] = useState("Approve-this-action");

  async function sendApproval() {
    setStatus("sending");
    setDetail("");
    const start = await fetch("/api/ciba/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bindingMessage }),
    });
    const started = await start.json();
    if (!start.ok) {
      setStatus("error");
      setDetail(started.error || "bc-authorize failed");
      return;
    }

    setStatus("pending");
    setDetail(`Email sent to ${started.email}. Check the inbox.`);
    let intervalMs = Math.max(5, Number(started.interval ?? 5)) * 1000;

    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    for (;;) {
      await wait(intervalMs);
      const poll = await fetch("/api/ciba/poll", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ authReqId: started.authReqId }),
      });
      const result = await poll.json();
      if (result.status === "approved") {
        setStatus("approved");
        setDetail("");
        return;
      }
      if (result.status === "denied") {
        setStatus("denied");
        setDetail(result.error || "Denied or expired");
        return;
      }
      if (result.status === "error") {
        setStatus("error");
        setDetail(result.error || "Poll failed");
        return;
      }
      if (result.interval) {
        intervalMs = Math.max(5, Number(result.interval)) * 1000;
      }
    }
  }

  const disabled = status === "sending" || status === "pending" || status === "approved";
  const label =
    status === "approved"
      ? "Approved"
      : status === "sending"
        ? "Sending email…"
        : status === "pending"
          ? "Waiting for email approval…"
          : "Send approval";

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-4">
      <label className="flex w-full flex-col gap-1 text-sm text-zinc-500">
        Binding message (shows on the email review)
        <input
          type="text"
          maxLength={64}
          disabled={disabled}
          value={bindingMessage}
          onChange={(event) => setBindingMessage(event.target.value)}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-900 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
        <span className="text-xs text-zinc-400">
          Auth0 allows letters, numbers, and +-_.,:# only. No spaces. Max 64 chars.
        </span>
      </label>
      <button
        type="button"
        disabled={disabled}
        onClick={sendApproval}
        className="rounded-full bg-zinc-900 px-8 py-3 text-base font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {label}
      </button>
      {detail ? (
        <p className="max-w-md text-center text-sm text-zinc-500">{detail}</p>
      ) : null}
    </div>
  );
}
