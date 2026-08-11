// Platform (Super Admin) tenant-health service (Phase SA-4F). Health is DERIVED
// (never a stored score) from real signals only: School status, SchoolOnboarding,
// current Subscription (+ trial expiry), and Invoices/Payments (overdue,
// outstanding, last payment). Usage-limit and support-SLA signals are explicitly
// EXCLUDED — they belong to their own future phases.
//
// Read-only: there is no "set health" mutation. To resolve a warning you fix the
// underlying source (subscription / invoice / onboarding / school status).
//
// The unit of health is the School (subscriptions/invoices are school-scoped).
import { prisma } from "@/lib/db/prisma";
import type { ListMeta } from "@/lib/server/api/response";
import { schoolStatusToUi, subscriptionStatusToUi } from "@/lib/server/api/enums";
import { EXPIRING_THRESHOLD_DAYS } from "./trials-service";
import { usageHealthReasons } from "./usage-service";
import type { Prisma } from "@/lib/generated/prisma/client";

const MS_PER_DAY = 86_400_000;
// A subscription is "current" (billable/relevant to health) in these states.
const CURRENT_SUB_STATUSES = ["TRIALING", "ACTIVE", "PAST_DUE"] as const;

export type HealthState = "healthy" | "attention" | "critical";

const ONBOARDING_UI: Record<string, string> = { NOT_STARTED: "not-started", IN_PROGRESS: "in-progress", COMPLETED: "completed" };

export type TenantHealthDto = {
  schoolId: string;
  schoolName: string;
  schoolCode: string;
  schoolStatus: string;
  tenantId: string;
  tenantName: string;
  onboardingStatus: string; // not-started | in-progress | completed | none
  subscriptionId: string | null;
  subscriptionStatus: string | null;
  plan: string | null;
  trialEnd: string | null;
  trialDaysRemaining: number | null;
  overdueInvoices: number;
  outstandingAmount: number;
  lastPaymentAt: string | null;
  healthState: HealthState;
  reasons: string[];
};

// --- Core derivation (shared by list + summary) -----------------------------

type SchoolRow = Prisma.SchoolGetPayload<{
  include: {
    tenant: { select: { id: true; name: true } };
    onboarding: { select: { status: true } };
    subscriptions: { select: { id: true; status: true; trialEnd: true; plan: { select: { name: true } } } };
  };
}>;

function computeHealth(
  school: SchoolRow,
  agg: { overdue: number; outstanding: number; lastPaymentAt: Date | null },
  now: Date,
): TenantHealthDto {
  // At most one current subscription per school (invariant from SA-4B).
  const current = school.subscriptions.find((s) => (CURRENT_SUB_STATUSES as readonly string[]).includes(s.status)) ?? null;
  const onboardingStatus = school.onboarding ? (ONBOARDING_UI[school.onboarding.status] ?? "not-started") : "none";
  const reasons: string[] = [];
  let state: HealthState = "healthy";

  const trialDaysRemaining = current?.trialEnd ? Math.ceil((current.trialEnd.getTime() - now.getTime()) / MS_PER_DAY) : null;

  // --- CRITICAL signals ---
  if (school.status === "SUSPENDED") {
    state = "critical";
    reasons.push("School is suspended");
  }
  if (current?.status === "PAST_DUE") {
    state = "critical";
    reasons.push("Subscription is past due");
  }

  // --- ATTENTION signals (only escalate from healthy) ---
  const attention = (reason: string) => {
    reasons.push(reason);
    if (state === "healthy") state = "attention";
  };

  if (school.status === "SETUP_PENDING" || (onboardingStatus !== "completed" && onboardingStatus !== "none")) {
    attention("Onboarding is incomplete");
  }
  if (school.status === "INACTIVE" || school.status === "ARCHIVED") {
    attention(`School is ${schoolStatusToUi[school.status]}`);
  }
  if (current?.status === "TRIALING" && current.trialEnd) {
    if (current.trialEnd.getTime() <= now.getTime()) attention("Trial has expired");
    else if (trialDaysRemaining !== null && trialDaysRemaining <= EXPIRING_THRESHOLD_DAYS) attention(`Trial ends in ${trialDaysRemaining} day${trialDaysRemaining === 1 ? "" : "s"}`);
  }
  if (agg.overdue > 0) attention(`${agg.overdue} overdue invoice${agg.overdue === 1 ? "" : "s"}`);
  else if (agg.outstanding > 0) attention("Has an outstanding balance");
  if (!current && school.status === "ACTIVE") attention("No active subscription");

  if (state === "healthy") reasons.push("All indicators healthy");

  return {
    schoolId: school.id,
    schoolName: school.name,
    schoolCode: school.code,
    schoolStatus: schoolStatusToUi[school.status],
    tenantId: school.tenant.id,
    tenantName: school.tenant.name,
    onboardingStatus,
    subscriptionId: current?.id ?? null,
    subscriptionStatus: current ? subscriptionStatusToUi[current.status] : null,
    plan: current?.plan.name ?? null,
    trialEnd: current?.trialEnd ? current.trialEnd.toISOString() : null,
    trialDaysRemaining,
    overdueInvoices: agg.overdue,
    outstandingAmount: Math.round(agg.outstanding * 100) / 100,
    lastPaymentAt: agg.lastPaymentAt ? agg.lastPaymentAt.toISOString() : null,
    healthState: state,
    reasons,
  };
}

/** Compute health for every school (batched aggregates). Small dataset — the
 * platform has a bounded number of schools, so we derive all then filter/paginate. */
async function computeAllHealth(): Promise<TenantHealthDto[]> {
  const now = new Date();
  const rawSchools = await prisma.school.findMany({
    include: {
      tenant: { select: { id: true, name: true } },
      onboarding: { select: { status: true } },
      subscriptions: { where: { status: { in: [...CURRENT_SUB_STATUSES] } }, take: 1, select: { id: true, status: true, trialEnd: true, plan: { select: { name: true } } } },
    },
    orderBy: { name: "asc" },
  });
  // Skip schools whose tenant is mid-deletion (Prisma loads the relation in a
  // second query, so a concurrent tenant cascade can leave `tenant` null).
  const schools = rawSchools.filter((s) => s.tenant != null);
  const schoolIds = schools.map((s) => s.id);
  if (schoolIds.length === 0) return [];

  const [outstandingRows, overdueRows, paymentRows] = await Promise.all([
    prisma.invoice.groupBy({ by: ["schoolId"], where: { schoolId: { in: schoolIds }, status: "OPEN" }, _sum: { amountDue: true } }),
    prisma.invoice.groupBy({ by: ["schoolId"], where: { schoolId: { in: schoolIds }, status: "OPEN", dueAt: { lt: now }, amountDue: { gt: 0 } }, _count: { _all: true } }),
    prisma.payment.groupBy({ by: ["schoolId"], where: { schoolId: { in: schoolIds }, status: "SUCCEEDED" }, _max: { receivedAt: true } }),
  ]);

  const outstandingBy = new Map(outstandingRows.map((r) => [r.schoolId, Number(r._sum.amountDue ?? 0)]));
  const overdueBy = new Map(overdueRows.map((r) => [r.schoolId, r._count._all]));
  const lastPayBy = new Map(paymentRows.map((r) => [r.schoolId, r._max.receivedAt]));

  // Real usage warnings (SA-4G) — reuse the centralized usage derivation; health
  // never recomputes usage itself. A tracked metric at WARNING/LIMIT_REACHED
  // becomes an ATTENTION reason.
  const usageReasonsBy = await usageHealthReasons(schoolIds);

  return schools.map((s) => {
    const dto = computeHealth(s, { overdue: overdueBy.get(s.id) ?? 0, outstanding: outstandingBy.get(s.id) ?? 0, lastPaymentAt: lastPayBy.get(s.id) ?? null }, now);
    const usageReasons = usageReasonsBy.get(s.id);
    if (usageReasons && usageReasons.length) {
      // Drop the "all healthy" placeholder if it was the only reason.
      const filtered = dto.reasons.filter((r) => r !== "All indicators healthy");
      dto.reasons = [...filtered, ...usageReasons];
      if (dto.healthState === "healthy") dto.healthState = "attention";
    }
    return dto;
  });
}

/**
 * Health for a single school (SA-4I: reused by the Support ticket badge so there
 * is no second tenant-health calculation). Same derivation as the list.
 */
export async function getSchoolHealth(schoolId: string): Promise<TenantHealthDto | null> {
  const now = new Date();
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    include: {
      tenant: { select: { id: true, name: true } },
      onboarding: { select: { status: true } },
      subscriptions: { where: { status: { in: [...CURRENT_SUB_STATUSES] } }, take: 1, select: { id: true, status: true, trialEnd: true, plan: { select: { name: true } } } },
    },
  });
  if (!school || school.tenant == null) return null;

  const [outstandingAgg, overdueCount, lastPay, usageReasonsBy] = await Promise.all([
    prisma.invoice.aggregate({ where: { schoolId, status: "OPEN" }, _sum: { amountDue: true } }),
    prisma.invoice.count({ where: { schoolId, status: "OPEN", dueAt: { lt: now }, amountDue: { gt: 0 } } }),
    prisma.payment.aggregate({ where: { schoolId, status: "SUCCEEDED" }, _max: { receivedAt: true } }),
    usageHealthReasons([schoolId]),
  ]);

  const dto = computeHealth(school, { overdue: overdueCount, outstanding: Number(outstandingAgg._sum.amountDue ?? 0), lastPaymentAt: lastPay._max.receivedAt ?? null }, now);
  const usageReasons = usageReasonsBy.get(schoolId);
  if (usageReasons && usageReasons.length) {
    dto.reasons = [...dto.reasons.filter((r) => r !== "All indicators healthy"), ...usageReasons];
    if (dto.healthState === "healthy") dto.healthState = "attention";
  }
  return dto;
}

// --- List -------------------------------------------------------------------

export type HealthListParams = {
  page: number;
  pageSize: number;
  search?: string;
  healthState?: string;
  schoolStatus?: string;
  subscriptionStatus?: string;
  sort?: "name" | "healthState";
  order?: "asc" | "desc";
};

const STATE_RANK: Record<HealthState, number> = { critical: 0, attention: 1, healthy: 2 };

export async function listTenantHealth(params: HealthListParams) {
  let all = await computeAllHealth();

  if (params.search) {
    const q = params.search.trim().toLowerCase();
    all = all.filter((h) => h.schoolName.toLowerCase().includes(q) || h.schoolCode.toLowerCase().includes(q) || h.tenantName.toLowerCase().includes(q));
  }
  if (params.healthState && ["healthy", "attention", "critical"].includes(params.healthState)) {
    all = all.filter((h) => h.healthState === params.healthState);
  }
  if (params.schoolStatus) all = all.filter((h) => h.schoolStatus === params.schoolStatus);
  if (params.subscriptionStatus) all = all.filter((h) => h.subscriptionStatus === params.subscriptionStatus);

  const dir = params.order === "desc" ? -1 : 1;
  if (params.sort === "name") all.sort((a, b) => dir * a.schoolName.localeCompare(b.schoolName));
  else all.sort((a, b) => (STATE_RANK[a.healthState] - STATE_RANK[b.healthState]) * dir || a.schoolName.localeCompare(b.schoolName));

  const total = all.length;
  const start = (params.page - 1) * params.pageSize;
  const data = all.slice(start, start + params.pageSize);
  const meta: ListMeta = { page: params.page, pageSize: params.pageSize, total, totalPages: Math.max(1, Math.ceil(total / params.pageSize)) };
  return { data, meta };
}

// --- Summary + Platform Pulse -----------------------------------------------

export type PlatformPulseFactor = { key: string; label: string; score: number; displayValue: string; tone: "success" | "warning" | "error" };

export type HealthSummary = {
  currency: string;
  totalSchools: number;
  healthy: number;
  attention: number;
  critical: number;
  setupPending: number;
  activeSubscriptions: number;
  trialingSubscriptions: number;
  pastDueSubscriptions: number;
  overdueInvoices: number;
  outstandingAmount: number;
  pulse: { score: number; factors: PlatformPulseFactor[] };
};

function toneFor(n: number): "success" | "warning" | "error" {
  return n >= 80 ? "success" : n >= 60 ? "warning" : "error";
}

export async function getHealthSummary(): Promise<HealthSummary> {
  const all = await computeAllHealth();
  const total = all.length;
  const denom = total || 1;

  const healthy = all.filter((h) => h.healthState === "healthy").length;
  const attention = all.filter((h) => h.healthState === "attention").length;
  const critical = all.filter((h) => h.healthState === "critical").length;
  const setupPending = all.filter((h) => h.schoolStatus === "setup-pending").length;
  const activeSubscriptions = all.filter((h) => h.subscriptionStatus === "active").length;
  const trialingSubscriptions = all.filter((h) => h.subscriptionStatus === "trialing").length;
  const pastDueSubscriptions = all.filter((h) => h.subscriptionStatus === "past-due").length;
  const overdueInvoices = all.reduce((sum, h) => sum + h.overdueInvoices, 0);
  const outstandingAmount = Math.round(all.reduce((sum, h) => sum + h.outstandingAmount, 0) * 100) / 100;

  // Real pulse factors — derived ONLY from real signals (no usage/support/config).
  const activeSchools = all.filter((h) => h.schoolStatus === "active").length;
  const onboarded = all.filter((h) => h.onboardingStatus === "completed").length;
  const withSub = all.filter((h) => h.subscriptionStatus !== null).length;
  const noOverdue = all.filter((h) => h.overdueInvoices === 0).length;
  const noOutstanding = all.filter((h) => h.outstandingAmount === 0).length;

  const pct = (n: number) => Math.round((n / denom) * 100);
  const factors: PlatformPulseFactor[] = [
    { key: "active", label: "Active schools", score: pct(activeSchools), displayValue: `${pct(activeSchools)}%`, tone: toneFor(pct(activeSchools)) },
    { key: "onboarding", label: "Onboarding complete", score: pct(onboarded), displayValue: `${pct(onboarded)}%`, tone: toneFor(pct(onboarded)) },
    { key: "subscriptions", label: "Subscribed", score: pct(withSub), displayValue: `${pct(withSub)}%`, tone: toneFor(pct(withSub)) },
    { key: "billing", label: "No overdue", score: pct(noOverdue), displayValue: `${pct(noOverdue)}%`, tone: toneFor(pct(noOverdue)) },
    { key: "collections", label: "Fully collected", score: pct(noOutstanding), displayValue: `${pct(noOutstanding)}%`, tone: toneFor(pct(noOutstanding)) },
  ];
  const score = total === 0 ? 0 : Math.round(factors.reduce((a, f) => a + f.score, 0) / factors.length);

  return {
    currency: "INR",
    totalSchools: total,
    healthy,
    attention,
    critical,
    setupPending,
    activeSubscriptions,
    trialingSubscriptions,
    pastDueSubscriptions,
    overdueInvoices,
    outstandingAmount,
    pulse: { score, factors },
  };
}
