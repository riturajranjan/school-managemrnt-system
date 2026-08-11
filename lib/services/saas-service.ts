import { getSnapshot, setState } from "@/lib/data/store";
import type {
  EntitlementLevel, InvoiceStatus, PlatformAnnouncement, SaasState, SaasTenantStatus,
  SupportTicketStatus,
} from "@/lib/types/saas";
import { generateId } from "@/lib/utils";

type Result = { ok: true } | { ok: false; error: string };

function patchSaas(updater: (s: SaasState) => SaasState) {
  setState((db) => ({ ...db, saas: updater(db.saas) }));
}

function logAudit(admin: string, action: string, tenantName: string, module: string, result: "success" | "denied" = "success") {
  patchSaas((s) => ({ ...s, auditLog: [{ id: generateId("pa"), admin, action, tenantName, module, timestamp: new Date().toISOString(), result }, ...s.auditLog] }));
}

const tenantName = (id: string) => getSnapshot().saas.tenants.find((t) => t.id === id)?.name ?? id;

// ---------------------------------------------------------------------------
// Tenants
// ---------------------------------------------------------------------------

export function setTenantStatus(tenantId: string, status: SaasTenantStatus, admin = "Super Admin"): Result {
  patchSaas((s) => ({ ...s, tenants: s.tenants.map((t) => (t.id === tenantId ? { ...t, status } : t)) }));
  logAudit(admin, status === "suspended" ? "School suspended" : status === "active" ? "School reactivated" : `Status → ${status}`, tenantName(tenantId), "Schools");
  return { ok: true };
}

// NOTE: mock `createTenant` was removed in Super Admin Phase SA-3 — school
// creation is now real (POST /api/super-admin/schools) and onboarding is real
// (SchoolOnboarding). The rest of this mock service still backs the not-yet-
// migrated Revenue/Platform/System pages.

export function addTenantNote(tenantId: string, text: string, by = "Super Admin"): Result {
  if (!text.trim()) return { ok: false, error: "Note cannot be empty." };
  patchSaas((s) => ({ ...s, tenants: s.tenants.map((t) => (t.id === tenantId ? { ...t, notes: [{ id: generateId("note"), at: new Date().toISOString(), by, text: text.trim() }, ...t.notes] } : t)) }));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------
// NOTE: the mock subscription CRUD (`changePlan`, `setSubscriptionStatus`) was
// removed in Super Admin Phase SA-4B — subscriptions are now real DB rows managed
// via /api/super-admin/subscriptions. `extendTrial` remains because the Trials
// page (SA-4C) still runs on the mock `db.saas.subscriptions` slice, which also
// backs the not-yet-migrated Billing/Health/revenue selectors.

export function extendTrial(subscriptionId: string, days: number, admin = "Super Admin"): Result {
  const db = getSnapshot();
  const sub = db.saas.subscriptions.find((s) => s.id === subscriptionId);
  if (!sub) return { ok: false, error: "Subscription not found." };
  if (sub.status !== "trial") return { ok: false, error: "Only trial subscriptions can be extended." };
  const base = sub.trialEndDate ? new Date(sub.trialEndDate) : new Date();
  base.setDate(base.getDate() + days);
  patchSaas((s) => ({ ...s, subscriptions: s.subscriptions.map((x) => (x.id === subscriptionId ? { ...x, trialEndDate: base.toISOString().slice(0, 10) } : x)) }));
  logAudit(admin, `Trial extended ${days}d`, tenantName(sub.tenantId), "Subscriptions");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Entitlement overrides
// ---------------------------------------------------------------------------

export function setEntitlementOverride(tenantId: string, featureKey: string, level: EntitlementLevel, reason: string, admin = "Super Admin"): Result {
  const db = getSnapshot();
  const existing = db.saas.overrides.find((o) => o.tenantId === tenantId && o.featureKey === featureKey);
  patchSaas((s) => {
    const next = existing
      ? s.overrides.map((o) => (o.id === existing.id ? { ...o, level, reason, at: new Date().toISOString() } : o))
      : [{ id: generateId("ovr"), tenantId, featureKey, level, reason, setBy: admin, at: new Date().toISOString() }, ...s.overrides];
    return { ...s, overrides: next };
  });
  logAudit(admin, "Entitlement overridden", tenantName(tenantId), "Plans");
  return { ok: true };
}

export function clearEntitlementOverride(overrideId: string): Result {
  patchSaas((s) => ({ ...s, overrides: s.overrides.filter((o) => o.id !== overrideId) }));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Invoices & payments
// ---------------------------------------------------------------------------

export function setInvoiceStatus(invoiceId: string, status: InvoiceStatus, admin = "Billing Admin"): Result {
  const db = getSnapshot();
  const inv = db.saas.invoices.find((i) => i.id === invoiceId);
  if (!inv) return { ok: false, error: "Invoice not found." };
  patchSaas((s) => {
    const invoices = s.invoices.map((i) => (i.id === invoiceId ? { ...i, status } : i));
    const payments = status === "paid" ? [{ id: generateId("pay"), tenantId: inv.tenantId, invoiceNumber: inv.number, amountMinor: inv.totalMinor, method: "Manual", date: new Date().toISOString().slice(0, 10), status: "successful" as const }, ...s.payments] : s.payments;
    return { ...s, invoices, payments };
  });
  if (status === "paid") logAudit(admin, "Invoice marked paid", tenantName(inv.tenantId), "Billing");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Support
// ---------------------------------------------------------------------------

export function setTicketStatus(ticketId: string, status: SupportTicketStatus): Result {
  patchSaas((s) => ({ ...s, support: s.support.map((t) => (t.id === ticketId ? { ...t, status, lastActivity: new Date().toISOString() } : t)) }));
  return { ok: true };
}

export function replyTicket(ticketId: string, text: string, internal: boolean, author = "Support"): Result {
  if (!text.trim()) return { ok: false, error: "Message cannot be empty." };
  patchSaas((s) => ({ ...s, support: s.support.map((t) => (t.id === ticketId ? { ...t, lastActivity: new Date().toISOString(), messages: [...t.messages, { id: generateId("m"), author, internal, at: new Date().toISOString(), text: text.trim() }] } : t)) }));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Announcements & marketplace
// ---------------------------------------------------------------------------

export function publishAnnouncement(input: { title: string; type: PlatformAnnouncement["type"]; audience: string; body: string }): Result {
  if (!input.title.trim()) return { ok: false, error: "Title is required." };
  patchSaas((s) => ({ ...s, announcements: [{ id: generateId("ann"), title: input.title.trim(), type: input.type, audience: input.audience, body: input.body, publishedAt: new Date().toISOString().slice(0, 10), status: "published" }, ...s.announcements] }));
  logAudit("Super Admin", "Announcement published", "All schools", "Announcements");
  return { ok: true };
}

export function toggleMarketplaceItem(itemId: string): Result {
  patchSaas((s) => ({ ...s, marketplace: s.marketplace.map((m) => (m.id === itemId && m.status !== "coming-soon" ? { ...m, status: m.status === "enabled" ? "available" : "enabled" } : m)) }));
  return { ok: true };
}
