// Fee Adjustments (Phase 9F) — the ONE canonical engine behind Discounts,
// Scholarships and Late Fees. `kind` picks the audit action and the sign
// (DISCOUNT/SCHOLARSHIP reduce a charge's balance, LATE_FEE increases it —
// see lib/server/fees/balance.ts). `computedAmount` is resolved and
// snapshotted at apply time; there is no edit endpoint, only apply — the
// original charge.amount is never mutated, so the obligation and every
// adjustment against it stay separately visible in history.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit, type AuditAction } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { FeeAdjustmentDto, FeeAdjustmentKindDto } from "@/lib/api/contracts";
import { dec } from "./money";
import { isBroadFeeManager } from "./access";

const KIND_TO_DB: Record<FeeAdjustmentKindDto, string> = { discount: "DISCOUNT", scholarship: "SCHOLARSHIP", late_fee: "LATE_FEE" };
const kindToUi = (k: string): FeeAdjustmentKindDto => (k === "SCHOLARSHIP" ? "scholarship" : k === "LATE_FEE" ? "late_fee" : "discount");
const KIND_TO_AUDIT: Record<FeeAdjustmentKindDto, AuditAction> = { discount: "FEE_DISCOUNT_APPLIED", scholarship: "FEE_SCHOLARSHIP_APPLIED", late_fee: "FEE_LATE_FEE_APPLIED" };

function toDto(a: { id: string; chargeId: string; kind: string; amountType: string; value: Prisma.Decimal; computedAmount: Prisma.Decimal; reason: string; appliedByName: string | null; createdAt: Date }): FeeAdjustmentDto {
  return {
    id: a.id, chargeId: a.chargeId, kind: kindToUi(a.kind), amountType: a.amountType === "PERCENTAGE" ? "percentage" : "fixed",
    value: dec(a.value), computedAmount: dec(a.computedAmount), reason: a.reason, appliedByName: a.appliedByName, createdAt: a.createdAt.toISOString(),
  };
}

export const applyFeeAdjustmentSchema = z.object({
  chargeId: z.string().min(1),
  kind: z.enum(["discount", "scholarship", "late_fee"]),
  amountType: z.enum(["fixed", "percentage"]),
  value: z.number().positive().max(1_000_000),
  reason: z.string().trim().min(1).max(500),
});

export async function applyFeeAdjustment(scope: OrgScope, raw: unknown): Promise<FeeAdjustmentDto> {
  if (!(await isBroadFeeManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  const input = parseInput(applyFeeAdjustmentSchema, raw);
  if (input.amountType === "percentage" && input.value > 100) throw new HttpError("VALIDATION_ERROR", "A percentage adjustment cannot exceed 100%");

  const charge = await prisma.feeCharge.findFirst({ where: { id: input.chargeId, schoolId: scope.schoolId }, select: { id: true, amount: true } });
  if (!charge) throw new HttpError("FEE_CHARGE_NOT_FOUND", "Fee charge not found");

  const computedAmount = input.amountType === "percentage" ? charge.amount.mul(input.value).div(100) : new Prisma.Decimal(input.value);

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.feeAdjustment.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, chargeId: input.chargeId, kind: KIND_TO_DB[input.kind] as never,
        amountType: input.amountType === "percentage" ? "PERCENTAGE" : "FIXED", value: input.value, computedAmount,
        reason: input.reason, appliedByUserId: scope.actor.id, appliedByName: scope.actor.name,
      },
    });
    await recordAudit(tx, scope, KIND_TO_AUDIT[input.kind], "FeeCharge", input.chargeId, { kind: input.kind, amount: dec(computedAmount) });
    return row;
  });
  return toDto(created);
}
