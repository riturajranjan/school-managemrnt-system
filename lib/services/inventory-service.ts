import { getSnapshot, setState } from "@/lib/data/store";
import type { InventoryIssue, InventoryItem, InventoryMovement, InventoryTransfer, IssueRecipientType, MovementType } from "@/lib/types/inventory";
import type { Money } from "@/lib/finance/money";
import { generateId } from "@/lib/utils";
import { logResourceAudit } from "./resource-audit-service";

type Actor = { name: string; role: string };
type Result = { ok: true } | { ok: false; error: string };

export function deriveItemStatus(item: Pick<InventoryItem, "quantity" | "minimumLevel" | "reorderLevel" | "status">): InventoryItem["status"] {
  if (item.status === "discontinued" || item.status === "expired") return item.status;
  if (item.quantity <= 0) return "out-of-stock";
  if (item.quantity <= item.reorderLevel) return "low-stock";
  return "in-stock";
}

export type ItemDraft = Omit<InventoryItem, "id" | "quantity" | "status" | "barcode" | "createdAt" | "updatedAt"> & { openingQuantity?: number };

let barcodeCounter = 0;

export function createItem(draft: ItemDraft, actor: Actor): Result & { item?: InventoryItem } {
  const db = getSnapshot();
  if (db.inventoryItems.some((i) => i.sku.toLowerCase() === draft.sku.trim().toLowerCase())) return { ok: false, error: `SKU "${draft.sku}" is already in use.` };
  const now = new Date().toISOString();
  barcodeCounter += 1;
  const opening = Math.max(0, draft.openingQuantity ?? 0);
  const item: InventoryItem = {
    ...draft,
    id: generateId("invitem"),
    quantity: opening,
    status: opening <= 0 ? "out-of-stock" : opening <= draft.reorderLevel ? "low-stock" : "in-stock",
    barcode: `INV${Date.now().toString(36).toUpperCase()}${barcodeCounter}`,
    createdAt: now,
    updatedAt: now,
  };
  const movements: InventoryMovement[] = opening > 0 ? [{ id: generateId("invmov"), itemId: item.id, type: "receipt", quantityDelta: opening, balanceAfter: opening, unitCost: item.unitCost, reference: "Opening stock", actorName: actor.name, createdAt: now }] : [];
  setState((current) => ({ ...current, inventoryItems: [...current.inventoryItems, item], inventoryMovements: [...movements, ...current.inventoryMovements] }));
  logResourceAudit({ domain: "inventory", subjectId: item.id, action: "inventory-item-created", actorName: actor.name, actorRole: actor.role, summary: `Item "${item.name}" (${item.sku}) created.` });
  return { ok: true, item };
}

/** The ONLY path that changes an item's quantity. Appends a signed movement to
 * the ledger and recomputes the balance — never mutates quantity directly, and
 * refuses any movement that would drive stock negative. */
function applyMovement(itemId: string, type: MovementType, delta: number, opts: { reference?: string; linkedId?: string; unitCost?: Money; reason?: string; actorName: string }): Result & { balanceAfter?: number } {
  const db = getSnapshot();
  const item = db.inventoryItems.find((i) => i.id === itemId);
  if (!item) return { ok: false, error: "Item not found." };
  const balanceAfter = item.quantity + delta;
  if (balanceAfter < 0) return { ok: false, error: `Insufficient stock. Only ${item.quantity} ${item.unit}(s) of "${item.name}" available.` };

  const now = new Date().toISOString();
  const movement: InventoryMovement = { id: generateId("invmov"), itemId, type, quantityDelta: delta, balanceAfter, unitCost: opts.unitCost ?? item.unitCost, reference: opts.reference, linkedId: opts.linkedId, actorName: opts.actorName, reason: opts.reason, createdAt: now };
  setState((current) => ({
    ...current,
    inventoryMovements: [movement, ...current.inventoryMovements],
    inventoryItems: current.inventoryItems.map((i) => (i.id === itemId ? { ...i, quantity: balanceAfter, status: deriveItemStatus({ ...i, quantity: balanceAfter }), updatedAt: now } : i)),
  }));
  return { ok: true, balanceAfter };
}

export function receiveStock(itemId: string, quantity: number, actor: Actor, opts?: { reference?: string; unitCost?: Money }): Result {
  if (quantity <= 0) return { ok: false, error: "Receipt quantity must be greater than zero." };
  const result = applyMovement(itemId, "receipt", quantity, { reference: opts?.reference ?? "Goods receipt", unitCost: opts?.unitCost, actorName: actor.name });
  if (result.ok) logResourceAudit({ domain: "inventory", subjectId: itemId, action: "inventory-received", actorName: actor.name, actorRole: actor.role, summary: `Received ${quantity} unit(s).` });
  return result;
}

export function adjustStock(itemId: string, delta: number, actor: Actor, reason: string): Result {
  if (delta === 0) return { ok: false, error: "Adjustment cannot be zero." };
  if (!reason.trim()) return { ok: false, error: "A reason is required for stock adjustments." };
  const result = applyMovement(itemId, "adjustment", delta, { reference: "Manual adjustment", reason, actorName: actor.name });
  if (result.ok) logResourceAudit({ domain: "inventory", subjectId: itemId, action: "inventory-adjusted", actorName: actor.name, actorRole: actor.role, summary: `Adjusted stock by ${delta > 0 ? "+" : ""}${delta}.`, reason });
  return result;
}

export function writeOffStock(itemId: string, quantity: number, actor: Actor, reason: string): Result {
  if (quantity <= 0) return { ok: false, error: "Write-off quantity must be greater than zero." };
  const result = applyMovement(itemId, "write-off", -quantity, { reference: "Write-off", reason, actorName: actor.name });
  if (result.ok) logResourceAudit({ domain: "inventory", subjectId: itemId, action: "inventory-written-off", actorName: actor.name, actorRole: actor.role, summary: `Wrote off ${quantity} unit(s).`, reason });
  return result;
}

export type IssueDraft = { itemId: string; quantity: number; recipientType: IssueRecipientType; recipientName: string; department?: string; purpose?: string; expectedReturn?: string; returnable: boolean; approvedBy?: string };

export function issueStock(draft: IssueDraft, actor: Actor): Result & { issue?: InventoryIssue } {
  if (draft.quantity <= 0) return { ok: false, error: "Issue quantity must be greater than zero." };
  const now = new Date().toISOString();
  const issue: InventoryIssue = {
    id: generateId("invissue"),
    itemId: draft.itemId,
    quantity: draft.quantity,
    returnedQuantity: 0,
    recipientType: draft.recipientType,
    recipientName: draft.recipientName,
    department: draft.department,
    purpose: draft.purpose,
    issueDate: now.slice(0, 10),
    expectedReturn: draft.expectedReturn,
    returnable: draft.returnable,
    approvedBy: draft.approvedBy,
    status: draft.returnable ? "issued" : "consumed",
    createdAt: now,
    updatedAt: now,
  };
  const result = applyMovement(draft.itemId, "issue", -draft.quantity, { reference: `Issued to ${draft.recipientName}`, linkedId: issue.id, actorName: actor.name });
  if (!result.ok) return result;
  setState((current) => ({ ...current, inventoryIssues: [issue, ...current.inventoryIssues] }));
  logResourceAudit({ domain: "inventory", subjectId: draft.itemId, action: "inventory-issued", actorName: actor.name, actorRole: actor.role, summary: `Issued ${draft.quantity} unit(s) to ${draft.recipientName}.` });
  return { ok: true, issue };
}

export function returnIssue(issueId: string, quantity: number, actor: Actor, condition: "good" | "damaged" | "lost" = "good"): Result {
  const db = getSnapshot();
  const issue = db.inventoryIssues.find((i) => i.id === issueId);
  if (!issue) return { ok: false, error: "Issue not found." };
  if (!issue.returnable) return { ok: false, error: "This issue was consumable and cannot be returned." };
  const outstanding = issue.quantity - issue.returnedQuantity;
  if (quantity <= 0 || quantity > outstanding) return { ok: false, error: `Invalid return quantity. ${outstanding} unit(s) outstanding.` };

  // Only good-condition returns re-enter stock; damaged/lost are recorded but not restocked.
  const now = new Date().toISOString();
  if (condition === "good") {
    const result = applyMovement(issue.itemId, "return", quantity, { reference: `Returned from ${issue.recipientName}`, linkedId: issue.id, actorName: actor.name });
    if (!result.ok) return result;
  }
  const returnedQuantity = issue.returnedQuantity + quantity;
  const record = { id: generateId("invret"), issueId, itemId: issue.itemId, returnedQuantity: quantity, condition, lostQuantity: condition === "lost" ? quantity : 0, damagedQuantity: condition === "damaged" ? quantity : 0, receivedBy: actor.name, createdAt: now };
  setState((current) => ({
    ...current,
    inventoryReturns: [record, ...current.inventoryReturns],
    inventoryIssues: current.inventoryIssues.map((i) => (i.id === issueId ? { ...i, returnedQuantity, status: returnedQuantity >= i.quantity ? "returned" : "partially-returned", updatedAt: now } : i)),
  }));
  logResourceAudit({ domain: "inventory", subjectId: issue.itemId, action: "inventory-returned", actorName: actor.name, actorRole: actor.role, summary: `${quantity} unit(s) returned from ${issue.recipientName} (${condition}).` });
  return { ok: true };
}

export function transferStock(itemId: string, quantity: number, fromLocation: string, toLocation: string, actor: Actor): Result & { transfer?: InventoryTransfer } {
  if (quantity <= 0) return { ok: false, error: "Transfer quantity must be greater than zero." };
  const now = new Date().toISOString();
  // Transfer is modelled as an out+in pair so the ledger stays balanced.
  const out = applyMovement(itemId, "transfer-out", -quantity, { reference: `Transfer ${fromLocation} → ${toLocation}`, actorName: actor.name });
  if (!out.ok) return out;
  applyMovement(itemId, "transfer-in", quantity, { reference: `Transfer ${fromLocation} → ${toLocation}`, actorName: actor.name });
  const transfer: InventoryTransfer = { id: generateId("invtransfer"), itemId, quantity, fromLocation, toLocation, status: "completed", requestedBy: actor.name, completedAt: now, createdAt: now, updatedAt: now };
  setState((current) => ({ ...current, inventoryTransfers: [transfer, ...current.inventoryTransfers], inventoryItems: current.inventoryItems.map((i) => (i.id === itemId ? { ...i, storageLocation: toLocation, updatedAt: now } : i)) }));
  logResourceAudit({ domain: "inventory", subjectId: itemId, action: "inventory-transferred", actorName: actor.name, actorRole: actor.role, summary: `Transferred ${quantity} unit(s) from ${fromLocation} to ${toLocation}.` });
  return { ok: true, transfer };
}
