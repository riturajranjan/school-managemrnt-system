// Platform (Super Admin) usage & limits service (Phase SA-4G). Usage is DERIVED
// LIVE from real rows (no stored counters) and compared against the current
// Subscription's Plan limits:
//   students → COUNT(Student status=ACTIVE, schoolId)
//   branches → COUNT(Branch status≠ARCHIVED, schoolId)
// Staff and storage have NO real backend yet, so they are reported honestly as
// NOT_TRACKED — never fabricated. A school with no current subscription has no
// limits to compare against → NO_SUBSCRIPTION.
//
// Visibility only: SA-4G surfaces usage vs limits. It does NOT enforce quotas
// (no PLAN_LIMIT_REACHED blocking on create/import) — enforcement is future work.
import { prisma } from "@/lib/db/prisma";
import type { ListMeta } from "@/lib/server/api/response";
import type { Prisma } from "@/lib/generated/prisma/client";

// >=80% & <100% → WARNING; >=100% → LIMIT_REACHED.
const WARNING_THRESHOLD = 80;

export type UsageState = "NORMAL" | "WARNING" | "LIMIT_REACHED" | "UNLIMITED" | "NOT_TRACKED" | "NO_SUBSCRIPTION";

export type UsageMetricDto = {
  key: string; // students | branches | staff | storage
  label: string;
  used: number | null; // null when NOT_TRACKED
  limit: number | null; // null = unlimited (or no plan)
  percent: number | null; // null unless a real used+limit pair exists
  state: UsageState;
  unit: string | null;
};

export type SchoolUsageDto = {
  schoolId: string;
  schoolName: string;
  schoolCode: string;
  tenantId: string;
  tenantName: string;
  subscriptionId: string | null;
  plan: { id: string; name: string } | null;
  metrics: UsageMetricDto[];
  warnings: string[]; // labels of metrics at WARNING or LIMIT_REACHED
};

// Metric definitions. `tracked` = we can measure it from a real backend today.
const METRICS: { key: string; label: string; unit: string | null; tracked: boolean; limitField: "maxStudents" | "maxBranches" | "maxStaff" | "storageGb" }[] = [
  { key: "students", label: "Students", unit: null, tracked: true, limitField: "maxStudents" },
  { key: "branches", label: "Branches", unit: null, tracked: true, limitField: "maxBranches" },
  { key: "staff", label: "Staff", unit: null, tracked: false, limitField: "maxStaff" },
  { key: "storage", label: "Storage", unit: "GB", tracked: false, limitField: "storageGb" },
];

/** Centralized state derivation — the ONLY authority for usage state. */
function deriveMetric(def: (typeof METRICS)[number], used: number | null, limit: number | null, hasPlan: boolean): UsageMetricDto {
  const base = { key: def.key, label: def.label, unit: def.unit };
  if (!def.tracked) return { ...base, used: null, limit: hasPlan ? limit : null, percent: null, state: "NOT_TRACKED" };
  if (!hasPlan) return { ...base, used, limit: null, percent: null, state: "NO_SUBSCRIPTION" };
  if (limit === null) return { ...base, used, limit: null, percent: null, state: "UNLIMITED" };
  const percent = limit === 0 ? 100 : Math.round(((used ?? 0) / limit) * 1000) / 10;
  const state: UsageState = percent >= 100 ? "LIMIT_REACHED" : percent >= WARNING_THRESHOLD ? "WARNING" : "NORMAL";
  return { ...base, used, limit, percent, state };
}

type SchoolRow = Prisma.SchoolGetPayload<{
  include: {
    tenant: { select: { id: true; name: true } };
    subscriptions: { select: { id: true; plan: { select: { id: true; name: true; maxStudents: true; maxBranches: true; maxStaff: true; storageGb: true } } } };
  };
}>;

const CURRENT_SUB_STATUSES = ["TRIALING", "ACTIVE", "PAST_DUE"] as const;

function buildSchoolUsage(school: SchoolRow, studentCount: number, branchCount: number): SchoolUsageDto {
  const current = school.subscriptions[0] ?? null;
  const plan = current?.plan ?? null;
  const hasPlan = Boolean(plan);
  const limitFor = (field: "maxStudents" | "maxBranches" | "maxStaff" | "storageGb"): number | null => (plan ? plan[field] : null);
  const usedFor = (key: string): number | null => (key === "students" ? studentCount : key === "branches" ? branchCount : null);

  const metrics = METRICS.map((def) => deriveMetric(def, usedFor(def.key), limitFor(def.limitField), hasPlan));
  const warnings = metrics.filter((m) => m.state === "WARNING" || m.state === "LIMIT_REACHED").map((m) => m.label);

  return {
    schoolId: school.id,
    schoolName: school.name,
    schoolCode: school.code,
    tenantId: school.tenant.id,
    tenantName: school.tenant.name,
    subscriptionId: current?.id ?? null,
    plan: plan ? { id: plan.id, name: plan.name } : null,
    metrics,
    warnings,
  };
}

/** Compute usage for every school (batched grouped counts — no N+1). */
async function computeAllUsage(): Promise<SchoolUsageDto[]> {
  const rawSchools = await prisma.school.findMany({
    include: {
      tenant: { select: { id: true, name: true } },
      subscriptions: { where: { status: { in: [...CURRENT_SUB_STATUSES] } }, take: 1, select: { id: true, plan: { select: { id: true, name: true, maxStudents: true, maxBranches: true, maxStaff: true, storageGb: true } } } },
    },
    orderBy: { name: "asc" },
  });
  // Skip schools whose tenant is mid-deletion (concurrent cascade race).
  const schools = rawSchools.filter((s) => s.tenant != null);
  const schoolIds = schools.map((s) => s.id);
  if (schoolIds.length === 0) return [];

  const [studentRows, branchRows] = await Promise.all([
    prisma.student.groupBy({ by: ["schoolId"], where: { schoolId: { in: schoolIds }, status: "ACTIVE" }, _count: { _all: true } }),
    prisma.branch.groupBy({ by: ["schoolId"], where: { schoolId: { in: schoolIds }, status: { not: "ARCHIVED" } }, _count: { _all: true } }),
  ]);
  const studentBy = new Map(studentRows.map((r) => [r.schoolId, r._count._all]));
  const branchBy = new Map(branchRows.map((r) => [r.schoolId, r._count._all]));

  return schools.map((s) => buildSchoolUsage(s, studentBy.get(s.id) ?? 0, branchBy.get(s.id) ?? 0));
}

// --- List / detail ----------------------------------------------------------

export type UsageListParams = {
  page: number;
  pageSize: number;
  search?: string;
  state?: string; // filter schools having any metric in this state
  planId?: string;
  sort?: "name" | "students";
  order?: "asc" | "desc";
};

export async function listUsage(params: UsageListParams) {
  let all = await computeAllUsage();

  if (params.search) {
    const q = params.search.trim().toLowerCase();
    all = all.filter((u) => u.schoolName.toLowerCase().includes(q) || u.schoolCode.toLowerCase().includes(q) || u.tenantName.toLowerCase().includes(q));
  }
  if (params.state) {
    const target = params.state.toUpperCase();
    all = all.filter((u) => u.metrics.some((m) => m.state === target));
  }
  if (params.planId) all = all.filter((u) => u.plan?.id === params.planId);

  const dir = params.order === "desc" ? -1 : 1;
  if (params.sort === "students") {
    all.sort((a, b) => dir * (((a.metrics.find((m) => m.key === "students")?.used ?? 0) - (b.metrics.find((m) => m.key === "students")?.used ?? 0)) || a.schoolName.localeCompare(b.schoolName)));
  } else {
    all.sort((a, b) => dir * a.schoolName.localeCompare(b.schoolName));
  }

  const total = all.length;
  const start = (params.page - 1) * params.pageSize;
  const data = all.slice(start, start + params.pageSize);
  const meta: ListMeta = { page: params.page, pageSize: params.pageSize, total, totalPages: Math.max(1, Math.ceil(total / params.pageSize)) };
  return { data, meta };
}

export async function getSchoolUsage(schoolId: string): Promise<SchoolUsageDto | null> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    include: {
      tenant: { select: { id: true, name: true } },
      subscriptions: { where: { status: { in: [...CURRENT_SUB_STATUSES] } }, take: 1, select: { id: true, plan: { select: { id: true, name: true, maxStudents: true, maxBranches: true, maxStaff: true, storageGb: true } } } },
    },
  });
  if (!school) return null;
  const [students, branches] = await Promise.all([
    prisma.student.count({ where: { schoolId, status: "ACTIVE" } }),
    prisma.branch.count({ where: { schoolId, status: { not: "ARCHIVED" } } }),
  ]);
  return buildSchoolUsage(school, students, branches);
}

// --- Summary ----------------------------------------------------------------

export type UsageSummary = {
  schoolsTracked: number; // schools with a current subscription (limits to compare)
  schoolsWarning: number; // any metric WARNING
  schoolsAtLimit: number; // any metric LIMIT_REACHED
  limitWarnings: number; // schools with any WARNING or LIMIT_REACHED (dashboard tile)
  studentLimitWarnings: number;
  branchLimitWarnings: number;
};

function metric(u: SchoolUsageDto, key: string): UsageMetricDto | undefined {
  return u.metrics.find((m) => m.key === key);
}

export async function getUsageSummary(): Promise<UsageSummary> {
  const all = await computeAllUsage();
  const isWarnOrOver = (m?: UsageMetricDto) => m?.state === "WARNING" || m?.state === "LIMIT_REACHED";

  const schoolsTracked = all.filter((u) => u.plan !== null).length;
  const schoolsWarning = all.filter((u) => u.metrics.some((m) => m.state === "WARNING")).length;
  const schoolsAtLimit = all.filter((u) => u.metrics.some((m) => m.state === "LIMIT_REACHED")).length;
  const limitWarnings = all.filter((u) => u.warnings.length > 0).length;
  const studentLimitWarnings = all.filter((u) => isWarnOrOver(metric(u, "students"))).length;
  const branchLimitWarnings = all.filter((u) => isWarnOrOver(metric(u, "branches"))).length;

  return { schoolsTracked, schoolsWarning, schoolsAtLimit, limitWarnings, studentLimitWarnings, branchLimitWarnings };
}

// --- Health integration -----------------------------------------------------

/**
 * Usage-derived warning reasons per school, for Tenant Health (SA-4F). Reuses the
 * SAME centralized derivation — health never recomputes usage itself. Only
 * tracked metrics at WARNING/LIMIT_REACHED produce a reason.
 */
export async function usageHealthReasons(schoolIds: string[]): Promise<Map<string, string[]>> {
  if (schoolIds.length === 0) return new Map();
  const [schools, studentRows, branchRows] = await Promise.all([
    prisma.school.findMany({
      where: { id: { in: schoolIds } },
      include: {
        tenant: { select: { id: true, name: true } },
        subscriptions: { where: { status: { in: [...CURRENT_SUB_STATUSES] } }, take: 1, select: { id: true, plan: { select: { id: true, name: true, maxStudents: true, maxBranches: true, maxStaff: true, storageGb: true } } } },
      },
    }),
    prisma.student.groupBy({ by: ["schoolId"], where: { schoolId: { in: schoolIds }, status: "ACTIVE" }, _count: { _all: true } }),
    prisma.branch.groupBy({ by: ["schoolId"], where: { schoolId: { in: schoolIds }, status: { not: "ARCHIVED" } }, _count: { _all: true } }),
  ]);
  const studentBy = new Map(studentRows.map((r) => [r.schoolId, r._count._all]));
  const branchBy = new Map(branchRows.map((r) => [r.schoolId, r._count._all]));

  const out = new Map<string, string[]>();
  for (const s of schools) {
    if (s.tenant == null) continue; // concurrent tenant cascade
    const u = buildSchoolUsage(s, studentBy.get(s.id) ?? 0, branchBy.get(s.id) ?? 0);
    const reasons: string[] = [];
    for (const m of u.metrics) {
      if (m.state === "LIMIT_REACHED") reasons.push(`${m.label} limit reached (${m.used}/${m.limit})`);
      else if (m.state === "WARNING") reasons.push(`${m.label} at ${m.percent}% of limit`);
    }
    if (reasons.length) out.set(s.id, reasons);
  }
  return out;
}
