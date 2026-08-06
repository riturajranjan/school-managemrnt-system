import { getSnapshot, setState } from "@/lib/data/store";
import type { PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus } from "@/lib/types/accounting";
import { addMoney, multiplyMoney, percentOfMoney, subtractMoney, sumMoney, zeroMoney, type Money } from "@/lib/finance/money";
import { generateId } from "@/lib/utils";
import { logFinancialAudit } from "./finance-audit-service";

type Actor = { name: string; role: string };

export function purchaseOrderLineTotal(item: PurchaseOrderItem): Money {
  const base = multiplyMoney(item.rate, item.quantity);
  return addMoney(base, percentOfMoney(base, item.taxPercent));
}

export function purchaseOrderTotal(po: Pick<PurchaseOrder, "items" | "discount">): Money {
  const currency = po.items[0]?.rate.currency ?? "INR";
  const gross = sumMoney(po.items.map(purchaseOrderLineTotal), currency);
  return subtractMoney(gross, po.discount ?? zeroMoney(currency));
}

function nextPoNumber(count: number): string {
  return `PO-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;
}

export type PurchaseOrderDraft = Omit<PurchaseOrder, "id" | "poNumber" | "status" | "createdBy" | "createdAt" | "approvedBy" | "approvedAt">;

export function createPurchaseOrder(draft: PurchaseOrderDraft, actor: Actor): PurchaseOrder {
  const db = getSnapshot();
  const po: PurchaseOrder = { ...draft, id: generateId("po"), poNumber: nextPoNumber(db.purchaseOrders.length), status: "draft", createdBy: actor.name, createdAt: new Date().toISOString() };
  setState((current) => ({ ...current, purchaseOrders: [...current.purchaseOrders, po] }));
  logFinancialAudit({ action: "purchase-order-created", actorName: actor.name, actorRole: actor.role, summary: `Purchase order ${po.poNumber} created for ${formatVendor(db, po.vendorId)}.` });
  return po;
}

function formatVendor(db: ReturnType<typeof getSnapshot>, vendorId: string): string {
  return db.vendors.find((v) => v.id === vendorId)?.name ?? "vendor";
}

export function submitPurchaseOrder(poId: string, actor: Actor): { ok: true } | { ok: false; error: string } {
  return transition(poId, "draft", "submitted", actor, "purchase-order-status-changed");
}

export function approvePurchaseOrder(poId: string, actor: Actor): { ok: true } | { ok: false; error: string } {
  const db = getSnapshot();
  const po = db.purchaseOrders.find((p) => p.id === poId);
  if (!po) return { ok: false, error: "Purchase order not found." };
  if (po.status !== "submitted") return { ok: false, error: `Cannot approve a purchase order in "${po.status}" status.` };
  setState((current) => ({ ...current, purchaseOrders: current.purchaseOrders.map((p) => (p.id === poId ? { ...p, status: "approved", approvedBy: actor.name, approvedAt: new Date().toISOString() } : p)) }));
  logFinancialAudit({ action: "purchase-order-approved", actorName: actor.name, actorRole: actor.role, summary: `Purchase order ${po.poNumber} approved.` });
  return { ok: true };
}

const forwardTransitions: Partial<Record<PurchaseOrderStatus, PurchaseOrderStatus>> = {
  approved: "ordered",
  ordered: "partially-received",
  "partially-received": "received",
  received: "invoiced",
  invoiced: "paid",
};

export function advancePurchaseOrder(poId: string, actor: Actor): { ok: true } | { ok: false; error: string } {
  const db = getSnapshot();
  const po = db.purchaseOrders.find((p) => p.id === poId);
  if (!po) return { ok: false, error: "Purchase order not found." };
  const next = forwardTransitions[po.status];
  if (!next) return { ok: false, error: `Purchase order in "${po.status}" status cannot be advanced further.` };
  return transition(poId, po.status, next, actor, "purchase-order-status-changed");
}

export function cancelPurchaseOrder(poId: string, reason: string, actor: Actor): { ok: true } | { ok: false; error: string } {
  const db = getSnapshot();
  const po = db.purchaseOrders.find((p) => p.id === poId);
  if (!po) return { ok: false, error: "Purchase order not found." };
  if (po.status === "paid" || po.status === "cancelled") return { ok: false, error: `Cannot cancel a purchase order in "${po.status}" status.` };
  setState((current) => ({ ...current, purchaseOrders: current.purchaseOrders.map((p) => (p.id === poId ? { ...p, status: "cancelled" } : p)) }));
  logFinancialAudit({ action: "purchase-order-status-changed", actorName: actor.name, actorRole: actor.role, summary: `Purchase order ${po.poNumber} cancelled.`, reason });
  return { ok: true };
}

function transition(poId: string, expectedFrom: PurchaseOrderStatus, to: PurchaseOrderStatus, actor: Actor, action: "purchase-order-status-changed"): { ok: true } | { ok: false; error: string } {
  const db = getSnapshot();
  const po = db.purchaseOrders.find((p) => p.id === poId);
  if (!po) return { ok: false, error: "Purchase order not found." };
  if (po.status !== expectedFrom) return { ok: false, error: `Cannot move a purchase order from "${po.status}" to "${to}".` };
  setState((current) => ({ ...current, purchaseOrders: current.purchaseOrders.map((p) => (p.id === poId ? { ...p, status: to } : p)) }));
  logFinancialAudit({ action, actorName: actor.name, actorRole: actor.role, summary: `Purchase order ${po.poNumber} moved to ${to}.` });
  return { ok: true };
}
