import { getSnapshot, setState } from "@/lib/data/store";
import type {
  EntitlementLevel, PlatformAnnouncement, SaasState, SaasTenantStatus,
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
// Subscriptions & Trials — now REAL (no mock service methods)
// ---------------------------------------------------------------------------
// The mock subscription CRUD (`changePlan`, `setSubscriptionStatus`) was removed
// in SA-4B, and the mock `extendTrial` was removed in SA-4C. Subscriptions and
// trials are real DB rows managed via /api/super-admin/subscriptions and
// /api/super-admin/trials. The `db.saas.subscriptions` slice is retained only as
// read-only backing for the not-yet-migrated Billing/Health/revenue selectors.

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
// Billing & Invoices — now REAL (no mock service methods)
// ---------------------------------------------------------------------------
// The mock `setInvoiceStatus` (which also fabricated a Payment row) was removed
// in Super Admin Phase SA-4D. Billing + invoices are real DB rows managed via
// /api/super-admin/billing and /api/super-admin/invoices. The remaining
// `db.saas.invoices`/`payments` slices back only the still-mock global search
// (layout) and the not-yet-migrated Payments page.

// ---------------------------------------------------------------------------
// Support — now REAL (no mock service methods)
// ---------------------------------------------------------------------------
// The mock support CRUD (`setTicketStatus`, `replyTicket`) and `db.saas.support`
// slice were removed in Super Admin Phase SA-4I — support tickets are real DB
// rows managed via /api/super-admin/support (support-service).

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
