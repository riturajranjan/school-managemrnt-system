// Production migration (Phase B, HR Sub-batch 4) — HR Policies. Only
// PUBLISHED policies are ever exposed to Employee Self Service — a DRAFT
// never leaks (listMyPolicies filters server-side, never relies on frontend
// filtering). Acknowledgement is identity-scoped: an employee acknowledges
// ONLY their own Staff record, resolved server-side from the caller's
// session — the acknowledge endpoint takes no staffId parameter at all.
import { Prisma } from "@/lib/generated/prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import type { OrgScope } from "@/lib/server/api/scope";
import type { HrPolicyDto, HrPolicyStatusDto, MyHrPolicyDto } from "@/lib/api/contracts";

const STATUS_TO_DTO: Record<string, HrPolicyStatusDto> = { DRAFT: "draft", PUBLISHED: "published", ARCHIVED: "archived" };
const DTO_TO_STATUS = Object.fromEntries(Object.entries(STATUS_TO_DTO).map(([k, v]) => [v, k])) as Record<HrPolicyStatusDto, string>;
export const HR_POLICY_STATUS_VALUES = Object.keys(DTO_TO_STATUS) as [HrPolicyStatusDto, ...HrPolicyStatusDto[]];

/** "archived" is the delete-equivalent — a policy is a historical HR
 * record, never hard-deleted. */
export const HR_POLICY_NEXT_STATUS: Record<HrPolicyStatusDto, HrPolicyStatusDto[]> = {
  draft: ["published", "archived"],
  published: ["archived"],
  archived: [],
};

type Row = {
  id: string; title: string; category: string | null; content: string; version: string; effectiveDate: Date | null;
  status: string; createdByName: string | null; updatedByName: string | null; createdAt: Date; updatedAt: Date;
  _count: { acknowledgements: number };
};

const select = {
  id: true, title: true, category: true, content: true, version: true, effectiveDate: true, status: true,
  createdByName: true, updatedByName: true, createdAt: true, updatedAt: true,
  _count: { select: { acknowledgements: true } },
} satisfies Prisma.HrPolicySelect;

function toDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dto(row: Row): HrPolicyDto {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    content: row.content,
    version: row.version,
    effectiveDate: row.effectiveDate ? toDate(row.effectiveDate) : null,
    status: (STATUS_TO_DTO[row.status] ?? "draft") as HrPolicyStatusDto,
    acknowledgedCount: row._count.acknowledgements,
    createdByName: row.createdByName,
    updatedByName: row.updatedByName,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function requirePolicyRow(scope: OrgScope, policyId: string): Promise<Row> {
  const row = await prisma.hrPolicy.findFirst({
    where: { id: policyId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) },
    select,
  });
  if (!row) throw new HttpError("HR_POLICY_NOT_FOUND", "Policy not found");
  return row;
}

export async function listHrPolicies(scope: OrgScope, params: { status?: HrPolicyStatusDto } = {}): Promise<HrPolicyDto[]> {
  const where: Prisma.HrPolicyWhereInput = { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
  if (params.status) where.status = DTO_TO_STATUS[params.status] as never;
  const rows = await prisma.hrPolicy.findMany({ where, select, orderBy: { createdAt: "desc" } });
  return rows.map(dto);
}

export async function getHrPolicy(scope: OrgScope, policyId: string): Promise<HrPolicyDto> {
  return dto(await requirePolicyRow(scope, policyId));
}

/** Own-record read (Employee Self Service) — ONLY PUBLISHED policies, ever.
 * A DRAFT or ARCHIVED policy is never returned here regardless of caller. */
export async function listMyPolicies(scope: OrgScope, staffId: string): Promise<MyHrPolicyDto[]> {
  const [policies, acks] = await Promise.all([
    prisma.hrPolicy.findMany({ where: { schoolId: scope.schoolId, status: "PUBLISHED" }, select, orderBy: { effectiveDate: "desc" } }),
    prisma.staffPolicyAcknowledgement.findMany({ where: { schoolId: scope.schoolId, staffId }, select: { hrPolicyId: true, acknowledgedAt: true } }),
  ]);
  const ackByPolicy = new Map(acks.map((a) => [a.hrPolicyId, a.acknowledgedAt]));
  return policies.map((p) => ({
    id: p.id,
    title: p.title,
    category: p.category,
    content: p.content,
    version: p.version,
    effectiveDate: p.effectiveDate ? toDate(p.effectiveDate) : null,
    acknowledged: ackByPolicy.has(p.id),
    acknowledgedAt: ackByPolicy.get(p.id)?.toISOString() ?? null,
  }));
}

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const createHrPolicySchema = z.object({
  title: z.string().trim().min(1).max(160),
  category: z.string().trim().max(80).optional(),
  content: z.string().trim().min(1).max(20000),
  version: z.string().trim().min(1).max(40),
  effectiveDate: dateSchema.optional(),
});

async function resolveBranch(scope: OrgScope): Promise<string> {
  if (scope.branchId) return scope.branchId;
  const active = await prisma.branch.findMany({ where: { schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true } });
  if (active.length === 1) return active[0].id;
  throw new HttpError("INVALID_BRANCH", "Select a branch for this policy");
}

export async function createHrPolicy(scope: OrgScope, raw: unknown): Promise<HrPolicyDto> {
  const input = parseInput(createHrPolicySchema, raw);
  const branchId = await resolveBranch(scope);
  const row = await prisma.hrPolicy.create({
    data: {
      tenantId: scope.tenantId, schoolId: scope.schoolId, branchId,
      title: input.title, category: input.category, content: input.content, version: input.version,
      effectiveDate: input.effectiveDate ? new Date(`${input.effectiveDate}T00:00:00Z`) : null,
      createdByUserId: scope.actor.id, createdByName: scope.actor.name,
    },
    select,
  });
  await recordAudit(prisma, scope, "HR_POLICY_CREATED", "HrPolicy", row.id, { title: row.title });
  return dto(row);
}

export const updateHrPolicySchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  category: z.string().trim().max(80).nullable().optional(),
  content: z.string().trim().min(1).max(20000).optional(),
  version: z.string().trim().min(1).max(40).optional(),
  effectiveDate: dateSchema.nullable().optional(),
});

export async function updateHrPolicy(scope: OrgScope, policyId: string, raw: unknown): Promise<HrPolicyDto> {
  const input = parseInput(updateHrPolicySchema, raw);
  await requirePolicyRow(scope, policyId);
  const row = await prisma.hrPolicy.update({
    where: { id: policyId },
    data: {
      title: input.title, category: input.category, content: input.content, version: input.version,
      effectiveDate: input.effectiveDate === undefined ? undefined : input.effectiveDate ? new Date(`${input.effectiveDate}T00:00:00Z`) : null,
      updatedByUserId: scope.actor.id, updatedByName: scope.actor.name,
    },
    select,
  });
  await recordAudit(prisma, scope, "HR_POLICY_UPDATED", "HrPolicy", policyId, input);
  return dto(row);
}

export async function setHrPolicyStatus(scope: OrgScope, policyId: string, status: HrPolicyStatusDto): Promise<HrPolicyDto> {
  await requirePolicyRow(scope, policyId);
  const row = await prisma.hrPolicy.update({
    where: { id: policyId },
    data: { status: DTO_TO_STATUS[status] as never, updatedByUserId: scope.actor.id, updatedByName: scope.actor.name },
    select,
  });
  await recordAudit(prisma, scope, "HR_POLICY_STATUS_CHANGED", "HrPolicy", policyId, { status });
  return dto(row);
}

/** Employee acknowledges a PUBLISHED policy for THEMSELVES ONLY — staffId is
 * always resolved server-side by the caller (self-service route), never
 * accepted as a parameter here. Idempotent: acknowledging twice is a no-op. */
export async function acknowledgePolicy(scope: OrgScope, policyId: string, staffId: string): Promise<void> {
  const policy = await prisma.hrPolicy.findFirst({ where: { id: policyId, schoolId: scope.schoolId }, select: { id: true, status: true } });
  if (!policy) throw new HttpError("HR_POLICY_NOT_FOUND", "Policy not found");
  if (policy.status !== "PUBLISHED") throw new HttpError("HR_POLICY_NOT_PUBLISHED", "Only a published policy can be acknowledged");
  await prisma.staffPolicyAcknowledgement.upsert({
    where: { hrPolicyId_staffId: { hrPolicyId: policyId, staffId } },
    update: {},
    create: { tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: scope.branchId ?? (await resolveBranch(scope)), hrPolicyId: policyId, staffId },
  });
  await recordAudit(prisma, scope, "HR_POLICY_ACKNOWLEDGED", "HrPolicy", policyId, { staffId });
}
