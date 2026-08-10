// Platform (Super Admin) school onboarding (Phase SA-3). PLATFORM scope — gated
// by platform.onboarding.{view,manage} in the routes; the server owns all state
// and never trusts schoolId/tenantId/status/completion from the browser. Progress
// is computed from the code-defined required steps (never a stored percentage).
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { parseInput } from "@/lib/server/validation";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import type { OrgScope } from "@/lib/server/api/scope";
import type { ListMeta } from "@/lib/server/api/response";
import { schoolStatusToUi } from "@/lib/server/api/enums";
import { ONBOARDING_STEPS, REQUIRED_STEP_KEYS, isValidStepKey, onboardingProgressPercent } from "@/lib/api/onboarding-steps";
import type { OnboardingStatus, Prisma } from "@/lib/generated/prisma/client";

export type PlatformActor = { id: string; name: string | null };

function auditScope(actor: PlatformActor, tenantId: string, schoolId: string): OrgScope {
  return { tenantId, schoolId, branchId: null, academicSessionId: null, actor };
}

const onboardingStatusToUi: Record<OnboardingStatus, string> = {
  NOT_STARTED: "not-started",
  IN_PROGRESS: "in-progress",
  COMPLETED: "completed",
};
const onboardingStatusFromUi: Record<string, OnboardingStatus> = {
  "not-started": "NOT_STARTED",
  "in-progress": "IN_PROGRESS",
  completed: "COMPLETED",
};

// --- Serializer -------------------------------------------------------------

type OnboardingRow = Prisma.SchoolOnboardingGetPayload<{
  include: { school: { select: { id: true; name: true; code: true; status: true } } };
}>;

function serialize(o: OnboardingRow) {
  const completed = o.completedSteps;
  return {
    schoolId: o.schoolId,
    tenantId: o.tenantId,
    status: onboardingStatusToUi[o.status],
    currentStep: o.currentStep,
    completedSteps: completed,
    steps: ONBOARDING_STEPS.map((s) => ({ ...s, done: completed.includes(s.key) })),
    totalSteps: REQUIRED_STEP_KEYS.length,
    completedCount: REQUIRED_STEP_KEYS.filter((k) => completed.includes(k)).length,
    progress: onboardingProgressPercent(completed),
    startedAt: o.startedAt.toISOString(),
    completedAt: o.completedAt?.toISOString() ?? null,
    school: { id: o.school.id, name: o.school.name, code: o.school.code, status: schoolStatusToUi[o.school.status] },
  };
}

const includeSchool = { school: { select: { id: true, name: true, code: true, status: true } } } as const;

// --- Reads ------------------------------------------------------------------

export async function getOnboarding(schoolId: string) {
  const o = await prisma.schoolOnboarding.findUnique({ where: { schoolId }, include: includeSchool });
  if (!o) throw new HttpError("NOT_FOUND", "Onboarding not found for this school");
  return serialize(o);
}

export type OnboardingListParams = { page: number; pageSize: number; search?: string; status?: string };

export async function listOnboarding(params: OnboardingListParams) {
  const where: Prisma.SchoolOnboardingWhereInput = {};
  if (params.status && onboardingStatusFromUi[params.status]) where.status = onboardingStatusFromUi[params.status];
  if (params.search) {
    const q = params.search.trim();
    where.school = { OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }] };
  }
  const [total, rows, pending] = await Promise.all([
    prisma.schoolOnboarding.count({ where }),
    prisma.schoolOnboarding.findMany({
      where,
      include: includeSchool,
      orderBy: [{ status: "asc" }, { startedAt: "desc" }],
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    prisma.school.count({ where: { status: "SETUP_PENDING" } }),
  ]);
  const meta: ListMeta = { page: params.page, pageSize: params.pageSize, total, totalPages: Math.max(1, Math.ceil(total / params.pageSize)) };
  return { data: rows.map(serialize), meta, setupPending: pending };
}

/** Real "Setup pending" aggregate for the platform dashboard (SA-3, §12). */
export async function setupPendingCount(): Promise<number> {
  return prisma.school.count({ where: { status: "SETUP_PENDING" } });
}

// --- Writes -----------------------------------------------------------------

export const updateSchema = z.object({
  completedSteps: z.array(z.string()).optional(),
  currentStep: z.string().optional(),
});

export async function updateOnboarding(actor: PlatformActor, schoolId: string, raw: unknown) {
  const input = parseInput(updateSchema, raw);
  const existing = await prisma.schoolOnboarding.findUnique({ where: { schoolId }, select: { id: true, tenantId: true, status: true } });
  if (!existing) throw new HttpError("NOT_FOUND", "Onboarding not found for this school");
  if (existing.status === "COMPLETED") throw new HttpError("CONFLICT", "Onboarding is already complete");

  const data: Prisma.SchoolOnboardingUpdateInput = { status: "IN_PROGRESS" };
  if (input.completedSteps !== undefined) {
    // Only accept valid, de-duplicated step keys — never arbitrary client values.
    const clean = [...new Set(input.completedSteps.filter(isValidStepKey))];
    data.completedSteps = clean;
  }
  if (input.currentStep !== undefined) {
    if (!isValidStepKey(input.currentStep)) throw new HttpError("VALIDATION_ERROR", `Unknown step "${input.currentStep}"`);
    data.currentStep = input.currentStep;
  }

  await prisma.schoolOnboarding.update({ where: { schoolId }, data });
  await recordAudit(prisma, auditScope(actor, existing.tenantId, schoolId), "ONBOARDING_UPDATED", "SchoolOnboarding", schoolId);
  return getOnboarding(schoolId);
}

export async function completeOnboarding(actor: PlatformActor, schoolId: string) {
  const existing = await prisma.schoolOnboarding.findUnique({ where: { schoolId }, select: { id: true, tenantId: true, status: true, completedSteps: true } });
  if (!existing) throw new HttpError("NOT_FOUND", "Onboarding not found for this school");
  if (existing.status === "COMPLETED") throw new HttpError("CONFLICT", "Onboarding is already complete");

  // Every required step must be complete before activation.
  const missing = REQUIRED_STEP_KEYS.filter((k) => !existing.completedSteps.includes(k));
  if (missing.length > 0) {
    throw new HttpError("ONBOARDING_INCOMPLETE", `Complete all required steps first (missing: ${missing.join(", ")})`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.schoolOnboarding.update({ where: { schoolId }, data: { status: "COMPLETED", completedAt: new Date(), currentStep: "review" } });
    await tx.school.update({ where: { id: schoolId }, data: { status: "ACTIVE" } });
    await recordAudit(tx, auditScope(actor, existing.tenantId, schoolId), "ONBOARDING_COMPLETED", "School", schoolId);
  });
  return getOnboarding(schoolId);
}
