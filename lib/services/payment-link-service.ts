import { getSnapshot, setState } from "@/lib/data/store";
import type { PaymentGatewayProvider, PaymentLink } from "@/lib/types/payments";
import { sumMoney, type Money } from "@/lib/finance/money";
import { outstandingForItem } from "@/lib/selectors/fee-item-insights";
import { generateId } from "@/lib/utils";
import { logFinancialAudit } from "./finance-audit-service";
import { recordPayment, type RecordPaymentResult } from "./payment-service";

type Actor = { name: string; role: string };

/** No real gateway is wired up (there's no server here to hold API keys or
 * receive a hosted checkout redirect), so the "URL" is illustrative — enough
 * to demonstrate the link lifecycle (active → paid/expired/cancelled)
 * without pretending to integrate a specific provider. */
export function createPaymentLink(studentIds: string[], itemIds: string[], amount: Money, expiresInDays: number, actor: Actor, recurring = false): PaymentLink {
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();
  const link: PaymentLink = {
    id: generateId("plink"),
    studentIds,
    itemIds,
    amount,
    status: "active",
    url: `https://pay.novyra.edu.in/link/${generateId("tok")}`,
    expiresAt,
    createdAt: now,
    createdBy: actor.name,
    recurring,
  };
  setState((db) => ({ ...db, paymentLinks: [...db.paymentLinks, link] }));
  logFinancialAudit({ action: "payment-recorded", actorName: actor.name, actorRole: actor.role, summary: `Payment link created for ${studentIds.length} student(s), ${amount.minorUnits / 100} total.` });
  return link;
}

export function isPaymentLinkExpired(link: PaymentLink): boolean {
  return link.status === "active" && new Date(link.expiresAt).getTime() < Date.now();
}

export function cancelPaymentLink(linkId: string, actor: Actor) {
  setState((db) => ({ ...db, paymentLinks: db.paymentLinks.map((l) => (l.id === linkId ? { ...l, status: "cancelled" } : l)) }));
  logFinancialAudit({ action: "payment-recorded", actorName: actor.name, actorRole: actor.role, summary: `Payment link ${linkId} cancelled.` });
}

export type GatewayOutcome = "success" | "failure";

export type SimulateGatewayResult = { ok: true; results: RecordPaymentResult[] } | { ok: false; error: string };

/** Stands in for a verified webhook callback from a real payment gateway.
 * A real integration would verify the provider's signature on an inbound
 * HTTP request before trusting it; there's no server here to receive that
 * request, so this function is the trust boundary instead — it re-validates
 * the link's own state (not expired, not already paid, amount/currency
 * intact) before ever crediting a fee item, exactly as a real webhook
 * handler must never trust a client-reported "payment succeeded" on its own. */
export function simulateGatewayCallback(linkId: string, provider: PaymentGatewayProvider, outcome: GatewayOutcome, actor: Actor): SimulateGatewayResult {
  const db = getSnapshot();
  const link = db.paymentLinks.find((l) => l.id === linkId);
  if (!link) return { ok: false, error: "Payment link not found." };
  if (link.status === "paid") return { ok: false, error: "This payment link has already been paid." };
  if (link.status === "cancelled") return { ok: false, error: "This payment link has been cancelled." };
  if (isPaymentLinkExpired(link)) {
    setState((current) => ({ ...current, paymentLinks: current.paymentLinks.map((l) => (l.id === linkId ? { ...l, status: "expired" } : l)) }));
    return { ok: false, error: "This payment link has expired." };
  }

  if (outcome === "failure") {
    logFinancialAudit({ action: "payment-recorded", actorName: actor.name, actorRole: actor.role, summary: `Gateway payment failed for link ${linkId} (${provider}).` });
    return { ok: false, error: "Gateway reported a failed transaction. The link remains active for retry." };
  }

  const items = db.studentFeeItems.filter((i) => link.itemIds.includes(i.id));
  const results: RecordPaymentResult[] = [];

  for (const studentId of link.studentIds) {
    const studentItems = items.filter((i) => i.studentId === studentId);
    if (studentItems.length === 0) continue;
    const result = recordPayment(
      {
        studentId,
        itemIds: studentItems.map((i) => i.id),
        amount: sumMoney(studentItems.map((i) => outstandingForItem(i)), link.amount.currency),
        method: "online-gateway",
        gatewayProvider: provider,
        gatewayStatus: "successful",
        gatewayPaymentId: generateId("gw"),
        branch: "main",
        cashierName: "Online payment",
        idempotencyKey: `${linkId}-${studentId}`,
      },
      actor,
    );
    results.push(result);
  }

  setState((current) => ({ ...current, paymentLinks: current.paymentLinks.map((l) => (l.id === linkId ? { ...l, status: "paid", paidAt: new Date().toISOString() } : l)) }));
  logFinancialAudit({ action: "payment-recorded", actorName: actor.name, actorRole: actor.role, summary: `Payment link ${linkId} paid via ${provider} gateway callback (${link.studentIds.length} student(s)).` });
  return { ok: true, results };
}
