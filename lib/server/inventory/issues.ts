// Inventory Issue / Return (Phase 9O). A recipient is always a real Staff.id
// or Student.id when it's a person — never a name string — except OTHER
// (department/classroom/event/purpose: a genuine descriptive label, not a
// stand-in identity). Issuing posts one ISSUE movement; returning posts one
// RETURN movement and updates the issue's own transactionally-maintained
// returnedQuantity cache in the same transaction (never used as item stock
// authority — that always comes from the ledger/balance cache).
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { InventoryIssueDto } from "@/lib/api/contracts";
import { resolveInventoryBranch, staffDisplayName, studentDisplayName } from "./access";
import { getOrCreateDefaultLocation, requireLocationInScope } from "./locations";
import { postMovement } from "./ledger";

type Row = {
  id: string; itemId: string; locationId: string; quantity: number; returnedQuantity: number;
  recipientKind: string; recipientStaffId: string | null; recipientStudentId: string | null; recipientLabel: string | null;
  purpose: string | null; returnable: boolean; status: string; createdAt: Date; updatedAt: Date;
  item: { name: string; code: string };
  location: { name: string };
  staff: { firstName: string; lastName: string | null; displayName: string | null } | null;
  student: { firstName: string; lastName: string | null } | null;
};

const select = {
  id: true, itemId: true, locationId: true, quantity: true, returnedQuantity: true,
  recipientKind: true, recipientStaffId: true, recipientStudentId: true, recipientLabel: true,
  purpose: true, returnable: true, status: true, createdAt: true, updatedAt: true,
  item: { select: { name: true, code: true } },
  location: { select: { name: true } },
  staff: { select: { firstName: true, lastName: true, displayName: true } },
  student: { select: { firstName: true, lastName: true } },
} satisfies Prisma.InventoryIssueSelect;

function recipientName(r: Row): string {
  if (r.recipientKind === "STAFF" && r.staff) return staffDisplayName(r.staff);
  if (r.recipientKind === "STUDENT" && r.student) return studentDisplayName(r.student);
  return r.recipientLabel ?? "—";
}

function dto(r: Row): InventoryIssueDto {
  return {
    id: r.id, itemId: r.itemId, itemName: r.item.name, itemCode: r.item.code,
    locationId: r.locationId, locationName: r.location.name,
    quantity: r.quantity, returnedQuantity: r.returnedQuantity, outstandingQuantity: r.quantity - r.returnedQuantity,
    recipientKind: r.recipientKind.toLowerCase() as InventoryIssueDto["recipientKind"], recipientName: recipientName(r),
    purpose: r.purpose, returnable: r.returnable, status: r.status.toLowerCase().replace(/_/g, "-") as InventoryIssueDto["status"],
    createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
  };
}

export async function listIssues(scope: OrgScope, params: { status?: string; outstandingOnly?: boolean } = {}): Promise<InventoryIssueDto[]> {
  const where: Prisma.InventoryIssueWhereInput = { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
  if (params.status) where.status = params.status.toUpperCase().replace(/-/g, "_") as never;
  if (params.outstandingOnly) where.status = { not: "RETURNED" };
  const rows = await prisma.inventoryIssue.findMany({ where, select, orderBy: { createdAt: "desc" } });
  return rows.map(dto);
}

async function requireIssueRow(scope: OrgScope, issueId: string): Promise<Row> {
  const row = await prisma.inventoryIssue.findFirst({ where: { id: issueId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select });
  if (!row) throw new HttpError("INVENTORY_ISSUE_NOT_FOUND", "Issue not found");
  return row;
}

export const issueStockSchema = z
  .object({
    itemId: z.string().min(1),
    locationId: z.string().min(1).optional(),
    quantity: z.number().int().positive(),
    recipientKind: z.enum(["staff", "student", "other"]),
    recipientStaffId: z.string().min(1).optional(),
    recipientStudentId: z.string().min(1).optional(),
    recipientLabel: z.string().trim().max(160).optional(),
    purpose: z.string().trim().max(300).optional(),
    returnable: z.boolean().optional(),
  })
  .refine((v) => (v.recipientKind === "staff" ? Boolean(v.recipientStaffId) : v.recipientKind === "student" ? Boolean(v.recipientStudentId) : Boolean(v.recipientLabel?.trim())), {
    message: "A matching recipient identity/label is required for the chosen recipient kind",
  });

export async function issueStock(scope: OrgScope, raw: unknown): Promise<InventoryIssueDto> {
  const input = parseInput(issueStockSchema, raw);
  const branchId = await resolveInventoryBranch(scope);

  const item = await prisma.inventoryItem.findFirst({ where: { id: input.itemId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select: { id: true } });
  if (!item) throw new HttpError("INVENTORY_ITEM_NOT_FOUND", "Item not found");
  const location = input.locationId ? await requireLocationInScope(scope, input.locationId) : await getOrCreateDefaultLocation(scope);

  if (input.recipientKind === "staff") {
    const staff = await prisma.staff.findFirst({ where: { id: input.recipientStaffId, schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true } });
    if (!staff) throw new HttpError("INVALID_RECIPIENT", "Recipient must be a real, active staff member in this school");
  } else if (input.recipientKind === "student") {
    const student = await prisma.student.findFirst({ where: { id: input.recipientStudentId, schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true } });
    if (!student) throw new HttpError("INVALID_RECIPIENT", "Recipient must be a real, active student in this school");
  }

  const issueId = await prisma.$transaction(async (tx) => {
    const movement = await postMovement(tx, {
      tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, itemId: input.itemId, locationId: location.id,
      movementType: "ISSUE", quantity: input.quantity, referenceType: "InventoryIssue",
      createdByUserId: scope.actor.id, createdByName: scope.actor.name ?? "System",
    });
    const issue = await tx.inventoryIssue.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, itemId: input.itemId, locationId: location.id,
        quantity: input.quantity, recipientKind: input.recipientKind.toUpperCase() as never,
        recipientStaffId: input.recipientKind === "staff" ? input.recipientStaffId : null,
        recipientStudentId: input.recipientKind === "student" ? input.recipientStudentId : null,
        recipientLabel: input.recipientKind === "other" ? input.recipientLabel!.trim() : null,
        purpose: input.purpose, returnable: input.returnable ?? false, issuedByUserId: scope.actor.id,
      },
      select: { id: true },
    });
    await tx.inventoryStockMovement.update({ where: { id: movement.id }, data: { referenceId: issue.id } });
    await recordAudit(tx, scope, "INVENTORY_STOCK_ISSUED", "InventoryIssue", issue.id, { itemId: input.itemId, quantity: input.quantity });
    return issue.id;
  });

  return dto(await requireIssueRow(scope, issueId));
}

export const returnIssueSchema = z.object({
  quantity: z.number().int().positive(),
  condition: z.enum(["good", "damaged"]).default("good"),
});

export async function returnIssue(scope: OrgScope, issueId: string, raw: unknown): Promise<InventoryIssueDto> {
  const input = parseInput(returnIssueSchema, raw);
  const branchId = await resolveInventoryBranch(scope);
  const issue = await requireIssueRow(scope, issueId);
  if (!issue.returnable) throw new HttpError("VALIDATION_ERROR", "This issue is not returnable");
  const outstanding = issue.quantity - issue.returnedQuantity;
  if (input.quantity > outstanding) throw new HttpError("INVENTORY_RETURN_EXCEEDS_OUTSTANDING", `Only ${outstanding} unit(s) are outstanding`);

  await prisma.$transaction(async (tx) => {
    if (input.condition === "good") {
      await postMovement(tx, {
        tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, itemId: issue.itemId, locationId: issue.locationId,
        movementType: "RETURN", quantity: input.quantity, referenceType: "InventoryIssue", referenceId: issue.id,
        createdByUserId: scope.actor.id, createdByName: scope.actor.name ?? "System",
      });
    }
    // Damaged returns close out the outstanding balance without re-entering stock — the units are gone, not back on the shelf.
    const newReturned = issue.returnedQuantity + input.quantity;
    const updated = await tx.inventoryIssue.updateMany({
      where: { id: issue.id, returnedQuantity: issue.returnedQuantity },
      data: { returnedQuantity: newReturned, status: newReturned >= issue.quantity ? "RETURNED" : "PARTIALLY_RETURNED" },
    });
    if (updated.count === 0) throw new HttpError("CONFLICT", "This issue changed — retry");
    await recordAudit(tx, scope, "INVENTORY_STOCK_RETURNED", "InventoryIssue", issue.id, { quantity: input.quantity, condition: input.condition });
  });

  return dto(await requireIssueRow(scope, issueId));
}
