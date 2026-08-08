import "server-only";
import { prisma } from "@/lib/db/prisma";
import { ValidationError } from "../errors";
import { mapPrismaError } from "../prisma-errors";
import { requirePermission } from "../permissions";
import { recordAudit } from "../audit";
import { createSchoolInput } from "../validation/organization";
import type { RequestContext } from "../authz";

// School service. Every operation is tenant-scoped through the RequestContext —
// tenantId comes from validated membership, never from client input.

export async function listSchools(ctx: RequestContext) {
  requirePermission(ctx, "school.view");
  return prisma.school.findMany({
    where: { tenantId: ctx.tenantId },
    orderBy: { name: "asc" },
  });
}

export async function createSchool(ctx: RequestContext, rawInput: unknown) {
  requirePermission(ctx, "school.create");

  const parsed = createSchoolInput.safeParse(rawInput);
  if (!parsed.success) throw new ValidationError("Invalid school details.", { issues: parsed.error.issues });
  const input = parsed.data;

  try {
    const school = await prisma.school.create({
      data: { ...input, tenantId: ctx.tenantId },
    });
    await recordAudit({
      tenantId: ctx.tenantId,
      actorUserId: ctx.userId,
      action: "school.created",
      entityType: "School",
      entityId: school.id,
      metadata: { code: school.code },
    });
    return school;
  } catch (e) {
    mapPrismaError(e, { conflictMessage: `A school with code "${input.code}" already exists in this tenant.` });
  }
}
