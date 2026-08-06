import { getSnapshot, setState } from "@/lib/data/store";
import type { Receipt } from "@/lib/types/payments";
import { generateId } from "@/lib/utils";
import { logFinancialAudit } from "./finance-audit-service";
import { nextReceiptNumber } from "./payment-service";

type Actor = { name: string; role: string };

export type CancelReceiptResult = { ok: true } | { ok: false; error: string };

/** Cancels a receipt without deleting it — the historical record stays, only
 * its status changes, matching the "never delete posted financial records"
 * rule. Does not reverse the underlying payment or fee-item balances; that's
 * a deliberate refund decision (see refund-service), not implied by cancelling
 * a piece of paper. */
export function cancelReceipt(receiptId: string, reason: string, actor: Actor): CancelReceiptResult {
  const db = getSnapshot();
  const receipt = db.receipts.find((r) => r.id === receiptId);
  if (!receipt) return { ok: false, error: "Receipt not found." };
  if (receipt.status === "cancelled") return { ok: false, error: "Receipt is already cancelled." };

  setState((current) => ({
    ...current,
    receipts: current.receipts.map((r) => (r.id === receiptId ? { ...r, status: "cancelled", notes: [r.notes, `Cancelled: ${reason}`].filter(Boolean).join(" · ") } : r)),
  }));

  logFinancialAudit({ subjectId: receipt.studentId, action: "receipt-cancelled", actorName: actor.name, actorRole: actor.role, summary: `Receipt ${receipt.receiptNumber} cancelled.`, reason });
  return { ok: true };
}

/** Issues a fresh receipt carrying the same payment details — used when a
 * receipt was cancelled for a correctable reason (wrong printed name, etc.)
 * and a replacement is needed. The original stays in history as "replaced". */
export function reissueReceipt(receiptId: string, actor: Actor): Receipt | undefined {
  const db = getSnapshot();
  const original = db.receipts.find((r) => r.id === receiptId);
  if (!original) return undefined;

  const now = new Date().toISOString();
  const reissued: Receipt = { ...original, id: generateId("rcpt"), receiptNumber: nextReceiptNumber(db), issuedAt: now, status: "issued", supersededByReceiptId: undefined };

  setState((current) => ({
    ...current,
    receipts: [...current.receipts.map((r) => (r.id === receiptId ? { ...r, status: "replaced" as const, supersededByReceiptId: reissued.id } : r)), reissued],
  }));

  logFinancialAudit({ subjectId: original.studentId, action: "receipt-issued", actorName: actor.name, actorRole: actor.role, summary: `Receipt ${original.receiptNumber} reissued as ${reissued.receiptNumber}.` });
  return reissued;
}

export function addReceiptNote(receiptId: string, note: string, actor: Actor) {
  setState((db) => ({ ...db, receipts: db.receipts.map((r) => (r.id === receiptId ? { ...r, notes: [r.notes, note].filter(Boolean).join(" · ") } : r)) }));
  const receipt = getSnapshot().receipts.find((r) => r.id === receiptId);
  logFinancialAudit({ subjectId: receipt?.studentId, action: "receipt-issued", actorName: actor.name, actorRole: actor.role, summary: `Note added to receipt ${receipt?.receiptNumber ?? receiptId}: ${note}` });
}

export type SendChannel = "email" | "parent-portal" | "whatsapp";

/** No messaging backend exists in this demo — sending is simulated by
 * recording an audit entry rather than actually dispatching anything. The UI
 * is explicit that this is a simulated send, never claiming real delivery. */
export function simulateSendReceipt(receiptId: string, channel: SendChannel, actor: Actor) {
  const receipt = getSnapshot().receipts.find((r) => r.id === receiptId);
  if (!receipt) return;
  const channelLabel = channel === "email" ? "email" : channel === "parent-portal" ? "the parent portal" : "WhatsApp";
  logFinancialAudit({ subjectId: receipt.studentId, action: "receipt-issued", actorName: actor.name, actorRole: actor.role, summary: `Receipt ${receipt.receiptNumber} sent via ${channelLabel} (simulated — no messaging backend configured).` });
}
