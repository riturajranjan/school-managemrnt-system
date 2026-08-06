import { getSnapshot, setState } from "@/lib/data/store";
import type { Vendor } from "@/lib/types/accounting";
import { generateId } from "@/lib/utils";
import { logFinancialAudit } from "./finance-audit-service";

type Actor = { name: string; role: string };

export type VendorDraft = Omit<Vendor, "id" | "createdAt" | "status">;

export function createVendor(draft: VendorDraft, actor: Actor): Vendor {
  const vendor: Vendor = { ...draft, id: generateId("vendor"), status: "active", createdAt: new Date().toISOString() };
  setState((db) => ({ ...db, vendors: [...db.vendors, vendor] }));
  logFinancialAudit({ action: "vendor-created", actorName: actor.name, actorRole: actor.role, summary: `Vendor "${vendor.name}" created.` });
  return vendor;
}

export function updateVendor(vendorId: string, patch: Partial<VendorDraft>, actor: Actor): { ok: true } | { ok: false; error: string } {
  const db = getSnapshot();
  const vendor = db.vendors.find((v) => v.id === vendorId);
  if (!vendor) return { ok: false, error: "Vendor not found." };
  setState((current) => ({ ...current, vendors: current.vendors.map((v) => (v.id === vendorId ? { ...v, ...patch } : v)) }));
  logFinancialAudit({ action: "vendor-updated", actorName: actor.name, actorRole: actor.role, summary: `Vendor "${vendor.name}" updated.` });
  return { ok: true };
}

export function setVendorStatus(vendorId: string, status: Vendor["status"], actor: Actor): { ok: true } | { ok: false; error: string } {
  const db = getSnapshot();
  const vendor = db.vendors.find((v) => v.id === vendorId);
  if (!vendor) return { ok: false, error: "Vendor not found." };
  setState((current) => ({ ...current, vendors: current.vendors.map((v) => (v.id === vendorId ? { ...v, status } : v)) }));
  logFinancialAudit({ action: "vendor-updated", actorName: actor.name, actorRole: actor.role, summary: `Vendor "${vendor.name}" marked ${status}.` });
  return { ok: true };
}
