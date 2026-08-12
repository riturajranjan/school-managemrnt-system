import { setState } from "@/lib/data/store";
import type { PlatformAnnouncement, SaasState } from "@/lib/types/saas";
import { generateId } from "@/lib/utils";

type Result = { ok: true } | { ok: false; error: string };

function patchSaas(updater: (s: SaasState) => SaasState) {
  setState((db) => ({ ...db, saas: updater(db.saas) }));
}

function logAudit(admin: string, action: string, tenantName: string, module: string, result: "success" | "denied" = "success") {
  patchSaas((s) => ({ ...s, auditLog: [{ id: generateId("pa"), admin, action, tenantName, module, timestamp: new Date().toISOString(), result }, ...s.auditLog] }));
}

// ---------------------------------------------------------------------------
// Tenants / Schools — now REAL (no mock service methods)
// ---------------------------------------------------------------------------
// Mock `createTenant` was removed in SA-3 (real POST /api/super-admin/schools +
// onboarding). Mock tenant status/notes (`setTenantStatus`, `addTenantNote`) and
// the `db.saas.tenants` slice were removed in SA-4L — school records are real
// (School model + schools-service), and the platform tenant picker uses the real
// Schools API.

// ---------------------------------------------------------------------------
// Subscriptions & Trials — now REAL (no mock service methods)
// ---------------------------------------------------------------------------
// The mock subscription CRUD (`changePlan`, `setSubscriptionStatus`) was removed
// in SA-4B, and the mock `extendTrial` was removed in SA-4C. Subscriptions and
// trials are real DB rows managed via /api/super-admin/subscriptions and
// /api/super-admin/trials.

// ---------------------------------------------------------------------------
// Feature entitlements — now REAL (no mock service methods)
// ---------------------------------------------------------------------------
// Mock entitlement overrides (`setEntitlementOverride`, `clearEntitlementOverride`)
// and the `db.saas.overrides` slice were removed in SA-4L — feature entitlements
// are real (SchoolFeatureOverride + features-service, effective = override ??
// plan default from PlanFeature).

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
// Add-ons & Marketplace — now REAL (no mock service methods)
// ---------------------------------------------------------------------------
// The mock `toggleMarketplaceItem` and the `db.saas.addons`/`db.saas.marketplace`
// slices were removed in SA-4M — add-ons and marketplace apps are real (AddOn /
// SchoolAddOn / MarketplaceApp / SchoolMarketplaceInstallation models +
// addons-service / marketplace-service + /api/super-admin/{addons,marketplace}).

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------

export function publishAnnouncement(input: { title: string; type: PlatformAnnouncement["type"]; audience: string; body: string }): Result {
  if (!input.title.trim()) return { ok: false, error: "Title is required." };
  patchSaas((s) => ({ ...s, announcements: [{ id: generateId("ann"), title: input.title.trim(), type: input.type, audience: input.audience, body: input.body, publishedAt: new Date().toISOString().slice(0, 10), status: "published" }, ...s.announcements] }));
  logAudit("Super Admin", "Announcement published", "All schools", "Announcements");
  return { ok: true };
}
