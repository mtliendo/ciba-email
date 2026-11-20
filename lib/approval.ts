import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { calendarBindingMessage, type CalendarAction } from "./binding-message.ts";

export type PendingApproval = {
  owner: string;
  authReqId: string;
  eventId: string;
  action: CalendarAction;
  expiresAt: number;
  pollAt: number;
  interval: number;
};

export type ApprovalStatus =
  | {
      status: "pending";
      action: CalendarAction;
      bindingMessage: string;
      expiresAt: number;
      pollAfter: number;
    }
  | { status: "created"; link: string | null }
  | { status: "denied" | "expired" | "error"; detail: string };

export function pendingStatus(approval: PendingApproval, now = Date.now()): ApprovalStatus {
  return {
    status: "pending",
    action: approval.action,
    bindingMessage: calendarBindingMessage(approval.action, approval.eventId.slice(0, 8)),
    expiresAt: approval.expiresAt,
    pollAfter: Math.max(0, approval.pollAt - now),
  };
}

function approvalKey() {
  const secret = process.env.AUTH0_SECRET;
  if (!secret) throw new Error("Missing AUTH0_SECRET");
  return Buffer.from(hkdfSync("sha256", secret, "", "ciba-email/calendar-approval-v1", 32));
}

export function sealApproval(approval: PendingApproval) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", approvalKey(), nonce);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(approval)), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), ciphertext]).toString("base64url");
}

export function openApproval(value: string | undefined, owner: string): PendingApproval | null {
  if (!value || value.length > 4096) return null;
  try {
    const bytes = Buffer.from(value, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", approvalKey(), bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const approval = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString());
    return approval.owner === owner ? approval : null;
  } catch {
    return null;
  }
}

export async function advanceApproval(
  approval: PendingApproval,
  poll: (authReqId: string) => Promise<"approved" | "pending" | "slow_down" | "denied" | "expired">,
  create: (action: CalendarAction, eventId: string) => Promise<string | null>,
  now = Date.now,
): Promise<{ next?: PendingApproval; result: ApprovalStatus }> {
  const expired: ApprovalStatus = { status: "expired", detail: "This request expired. No event was created." };
  if (approval.expiresAt <= now()) return { result: expired };
  if (approval.pollAt > now()) return { next: approval, result: pendingStatus(approval, now()) };

  const status = await poll(approval.authReqId);
  if (status === "expired" || approval.expiresAt <= now()) return { result: expired };
  if (status === "denied") {
    return { result: { status: "denied", detail: "You declined the email request. No event was created." } };
  }
  if (status === "approved") {
    if (Date.parse(`${approval.action.start}Z`) <= now()) {
      return { result: { status: "expired", detail: "The event start time passed. No event was created." } };
    }
    const link = await create(approval.action, approval.eventId);
    return { result: { status: "created", link } };
  }

  const interval = approval.interval + (status === "slow_down" ? 5 : 0);
  const next = { ...approval, interval, pollAt: now() + interval * 1000 };
  return { next, result: pendingStatus(next, now()) };
}
