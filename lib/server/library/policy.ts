// Library Policy (Phase 9N) — one real, admin-editable row per school
// driving loan duration + fine calculation. Auto-created with visible
// defaults on first read; never a silently hardcoded business rule since
// it's stored and always editable via the real settings page.
import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { LibraryPolicyDto } from "@/lib/api/contracts";

function dto(p: { loanDurationDays: number; finePerDay: unknown; graceDays: number; maxFineAmount: unknown; updatedAt: Date }): LibraryPolicyDto {
  return {
    loanDurationDays: p.loanDurationDays,
    finePerDay: Number(p.finePerDay),
    graceDays: p.graceDays,
    maxFineAmount: p.maxFineAmount === null ? null : Number(p.maxFineAmount),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export async function getOrCreateLibraryPolicy(scope: OrgScope) {
  return prisma.libraryPolicy.upsert({
    where: { schoolId: scope.schoolId },
    create: { schoolId: scope.schoolId },
    update: {},
  });
}

export async function getLibraryPolicy(scope: OrgScope): Promise<LibraryPolicyDto> {
  return dto(await getOrCreateLibraryPolicy(scope));
}

export const updatePolicySchema = z.object({
  loanDurationDays: z.number().int().min(1).max(365).optional(),
  finePerDay: z.number().min(0).max(10000).optional(),
  graceDays: z.number().int().min(0).max(90).optional(),
  maxFineAmount: z.number().min(0).max(100000).nullable().optional(),
});

export async function updateLibraryPolicy(scope: OrgScope, raw: unknown): Promise<LibraryPolicyDto> {
  const input = parseInput(updatePolicySchema, raw);
  await getOrCreateLibraryPolicy(scope);
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.libraryPolicy.update({
      where: { schoolId: scope.schoolId },
      data: {
        loanDurationDays: input.loanDurationDays, finePerDay: input.finePerDay, graceDays: input.graceDays,
        maxFineAmount: input.maxFineAmount === undefined ? undefined : input.maxFineAmount,
        updatedByUserId: scope.actor.id,
      },
    });
    await recordAudit(tx, scope, "LIBRARY_POLICY_UPDATED", "LibraryPolicy", scope.schoolId);
    return row;
  });
  return dto(updated);
}
