import "server-only";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError, ValidationError } from "../errors";
import { mapPrismaError } from "../prisma-errors";
import { requirePermission } from "../permissions";
import { assertSchoolAccess, type RequestContext } from "../authz";
import { recordAudit } from "../audit";
import { createBranchInput } from "../validation/organization";

// Branch service. Access is checked at two levels: the permission AND the
// school scope (assertSchoolAccess), so a user scoped to one school cannot touch
// another school's branches even with branch.manage.

export async function listBranches(ctx: RequestContext, schoolId: string) {
  requirePermission(ctx, "branch.view");
  await assertSchoolInTenant(ctx, schoolId);
  assertSchoolAccess(ctx, schoolId);
  return prisma.branch.findMany({ where: { schoolId }, orderBy: { name: "asc" } });
}

export async function createBranch(ctx: RequestContext, schoolId: string, rawInput: unknown) {
  requirePermission(ctx, "branch.manage");
  await assertSchoolInTenant(ctx, schoolId);
  assertSchoolAccess(ctx, schoolId);

  const parsed = createBranchInput.safeParse(rawInput);
  if (!parsed.success) throw new ValidationError("Invalid branch details.", { issues: parsed.error.issues });
  const input = parsed.data;

  try {
    const branch = await prisma.branch.create({ data: { ...input, schoolId } });
    await recordAudit({
      tenantId: ctx.tenantId,
      actorUserId: ctx.userId,
      action: "branch.created",
      entityType: "Branch",
      entityId: branch.id,
      metadata: { schoolId, code: branch.code },
    });
    return branch;
  } catch (e) {
    mapPrismaError(e, { conflictMessage: `A branch with code "${input.code}" already exists in this school.` });
  }
}

// Guards that the school actually belongs to the context's tenant before any
// scope check — prevents cross-tenant school-id probing.
async function assertSchoolInTenant(ctx: RequestContext, schoolId: string): Promise<void> {
  const school = await prisma.school.findFirst({
    where: { id: schoolId, tenantId: ctx.tenantId },
    select: { id: true },
  });
  if (!school) throw new NotFoundError("School not found.");
}
