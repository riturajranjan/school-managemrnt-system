import type { Db } from "@/lib/data/store";
import type { SaasState, SaasTenant } from "@/lib/types/saas";

// ---------------------------------------------------------------------------
// Command centre metrics
// ---------------------------------------------------------------------------

// NOTE: fake MRR/ARR + overdue-invoice counts were removed from this summary in
// Super Admin Phase SA-4D — those are now real, derived server-side from
// PostgreSQL (GET /api/super-admin/billing/summary). The fields below back only
// still-mock dashboard tiles (schools counts, support/usage) and the Health page.
export type SaasSummary = {
  totalSchools: number; activeSchools: number; trialSchools: number; suspended: number; setupPending: number;
  activeSubscriptions: number; supportEscalations: number; limitWarnings: number; newThisMonth: number;
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
    activeSubscriptions: s.subscriptions.filter((sub) => sub.status === "active").length,
    supportEscalations: s.support.filter((t) => t.status === "escalated").length,
    limitWarnings: s.usage.filter((u) => u.limit > 0 && u.used / u.limit >= 0.8).length,
    newThisMonth: s.tenants.filter((t) => t.createdAt >= monthAgo.toISOString().slice(0, 10)).length,
  };
}

// ---------------------------------------------------------------------------
// Platform Pulse — aggregate operational health (not churn prediction).
// ---------------------------------------------------------------------------

export type PulseFactor = { key: string; label: string; score: number; displayValue: string; tone: "success" | "warning" | "error" };

function toneFor(n: number): "success" | "warning" | "error" { return n >= 80 ? "success" : n >= 60 ? "warning" : "error"; }

export function platformPulse(db: Db): { score: number; factors: PulseFactor[] } {
  const s = db.saas;
  const total = s.tenants.length || 1;
  const activeRatio = Math.round((s.tenants.filter((t) => t.status === "active").length / total) * 100);
  const setup = Math.round(s.tenants.reduce((sum, t) => sum + t.setupPercent, 0) / total);
  const subHealth = Math.round((s.subscriptions.filter((sub) => sub.status === "active" || sub.status === "trial").length / (s.subscriptions.length || 1)) * 100);
  const openTickets = s.support.filter((t) => t.status !== "resolved" && t.status !== "closed").length;
  const supportLoad = Math.max(0, 100 - openTickets * 6);
  const atRiskUsage = s.usage.filter((u) => u.limit > 0 && u.used / u.limit >= 0.9).length;
  const usageRisk = Math.max(0, 100 - atRiskUsage * 8);
  const configItems = [s.plans.length > 0, s.announcements.some((a) => a.status === "published"), s.admins.length > 0, s.settings.platformName.length > 0];
  const config = Math.round((configItems.filter(Boolean).length / configItems.length) * 100);

  const factors: PulseFactor[] = [
    { key: "active", label: "Active tenant ratio", score: activeRatio, displayValue: `${activeRatio}%`, tone: toneFor(activeRatio) },
    { key: "setup", label: "Setup completion", score: setup, displayValue: `${setup}%`, tone: toneFor(setup) },
    { key: "subs", label: "Subscription health", score: subHealth, displayValue: `${subHealth}%`, tone: toneFor(subHealth) },
    { key: "support", label: "Support load", score: supportLoad, displayValue: `${openTickets} open`, tone: toneFor(supportLoad) },
    { key: "usage", label: "Usage-limit risk", score: usageRisk, displayValue: `${atRiskUsage} near limit`, tone: toneFor(usageRisk) },
    { key: "config", label: "Platform config", score: config, displayValue: `${config}%`, tone: toneFor(config) },
  ];
  const score = Math.round(factors.reduce((a, f) => a + f.score, 0) / factors.length);
  return { score, factors };
}

// ---------------------------------------------------------------------------
// Tenant health — transparent, rule-based (never AI churn prediction).
// ---------------------------------------------------------------------------

export type HealthState = "healthy" | "needs-attention" | "at-risk" | "suspended";

export const healthLabels: Record<HealthState, string> = { healthy: "Healthy", "needs-attention": "Needs attention", "at-risk": "At risk", suspended: "Suspended" };
export const healthTone: Record<HealthState, "success" | "warning" | "error" | "neutral"> = { healthy: "success", "needs-attention": "warning", "at-risk": "error", suspended: "neutral" };

export type TenantHealth = { state: HealthState; reasons: string[]; recommendations: string[] };

export function tenantHealth(saas: SaasState, tenant: SaasTenant): TenantHealth {
  if (tenant.status === "suspended") return { state: "suspended", reasons: ["Subscription suspended"], recommendations: ["Resolve billing to reactivate"] };
  const reasons: string[] = [];
  const recommendations: string[] = [];
  let severity = 0;

  const sub = saas.subscriptions.find((x) => x.tenantId === tenant.id);
  if (sub?.status === "past-due" || tenant.status === "payment-due") { reasons.push("Invoice payment is overdue"); recommendations.push("Follow up on payment"); severity += 2; }
  if (sub?.status === "grace-period" || tenant.status === "grace-period") { reasons.push("In grace period after failed payment"); recommendations.push("Contact billing owner"); severity += 2; }
  if (sub?.trialEndDate) { const days = Math.ceil((new Date(sub.trialEndDate).getTime() - Date.now()) / 86400000); if (days >= 0 && days <= 5) { reasons.push(`Trial ends in ${days} day${days === 1 ? "" : "s"}`); recommendations.push("Reach out to convert"); severity += 1; } }
  const nearLimit = saas.usage.filter((u) => u.tenantId === tenant.id && u.limit > 0 && u.used / u.limit >= 0.9);
  nearLimit.forEach((u) => { reasons.push(`${u.key} usage at ${Math.round((u.used / u.limit) * 100)}%`); severity += 1; });
  if (nearLimit.length > 0) recommendations.push("Review plan or add capacity add-on");
  const openTickets = saas.support.filter((t) => t.tenantId === tenant.id && t.status !== "resolved" && t.status !== "closed").length;
  if (openTickets >= 2) { reasons.push(`${openTickets} unresolved support tickets`); recommendations.push("Resolve support issues"); severity += 1; }
  if (tenant.setupPercent < 60) { reasons.push(`Setup only ${tenant.setupPercent}% complete`); recommendations.push("Assist with onboarding"); severity += 1; }
  if (tenant.status === "inactive") { reasons.push("No recent activity"); recommendations.push("Re-engage the school"); severity += 2; }

  const state: HealthState = severity >= 3 ? "at-risk" : severity >= 1 ? "needs-attention" : "healthy";
  if (state === "healthy") { reasons.push("All indicators within normal range"); }
  return { state, reasons, recommendations };
}

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
