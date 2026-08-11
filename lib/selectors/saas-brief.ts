import type { Db } from "@/lib/data/store";

// ---------------------------------------------------------------------------
// Command centre metrics
// ---------------------------------------------------------------------------

// NOTE: fake MRR/ARR/overdue removed in SA-4D, activeSubscriptions in SA-4F,
// `limitWarnings` in SA-4G, and `supportEscalations` in SA-4I — all real now
// (billing/usage/support services). The remaining fields back still-mock
// dashboard tiles (tenant/school counts).
export type SaasSummary = {
  totalSchools: number; activeSchools: number; trialSchools: number; suspended: number; setupPending: number;
  newThisMonth: number;
};

export function saasSummary(db: Db): SaasSummary {
  const s = db.saas;
  const active = s.tenants.filter((t) => t.status === "active");
  const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30);
  return {
    totalSchools: s.tenants.length,
    activeSchools: active.length,
    trialSchools: s.tenants.filter((t) => t.status === "trial").length,
    suspended: s.tenants.filter((t) => t.status === "suspended").length,
    setupPending: s.tenants.filter((t) => t.status === "setup-pending").length,
    newThisMonth: s.tenants.filter((t) => t.createdAt >= monthAgo.toISOString().slice(0, 10)).length,
  };
}

// NOTE: the mock `platformPulse` was removed in SA-4F and the mock `tenantHealth`
// helper (+ HealthState/TenantHealth/healthLabels/healthTone) in SA-4I — tenant
// health + Platform Pulse are real now (health-service + /api/super-admin/health).
// Support was tenantHealth's last consumer and now uses the real health badge.

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export function planDistribution(db: Db) {
  return db.saas.plans.map((p) => ({ id: p.id, name: p.name, count: db.saas.tenants.filter((t) => t.planId === p.id).length }));
}

export function statusDistribution(db: Db) {
  const map = new Map<string, number>();
  db.saas.tenants.forEach((t) => map.set(t.status, (map.get(t.status) ?? 0) + 1));
  return [...map.entries()].map(([status, count]) => ({ status, count }));
}

export function schoolsByMonth(db: Db) {
  const map = new Map<string, number>();
  db.saas.tenants.forEach((t) => { const m = t.createdAt.slice(0, 7); map.set(m, (map.get(m) ?? 0) + 1); });
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-8).map(([month, count]) => ({ month, count }));
}

// NOTE: the mock `trialRows` selector was removed in Super Admin Phase SA-4C —
// the Trials page is now real (GET /api/super-admin/trials). Remaining selectors
// here still back not-yet-migrated Billing/Health/dashboard-revenue surfaces.
