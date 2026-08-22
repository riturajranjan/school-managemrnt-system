// Hostel Staff (Warden) Assignment (Phase 9Q). Warden identity is always a
// real, active Staff.id — never a free-text name or a parallel identity.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { HostelStaffAssignmentDto } from "@/lib/api/contracts";
import { requireHostelInScope } from "./hostels";
import { staffDisplayName } from "./access";

type Row = {
  id: string; hostelId: string; staffId: string; role: string; status: string; assignedAt: Date; endedAt: Date | null; createdAt: Date;
  hostel: { name: string };
  staff: { firstName: string; lastName: string | null; displayName: string | null; employeeCode: string };
};

const select = {
  id: true, hostelId: true, staffId: true, role: true, status: true, assignedAt: true, endedAt: true, createdAt: true,
  hostel: { select: { name: true } },
  staff: { select: { firstName: true, lastName: true, displayName: true, employeeCode: true } },
} satisfies Prisma.HostelStaffAssignmentSelect;

function dto(r: Row): HostelStaffAssignmentDto {
  return {
    id: r.id, hostelId: r.hostelId, hostelName: r.hostel.name, staffId: r.staffId, staffName: staffDisplayName(r.staff), employeeCode: r.staff.employeeCode,
    role: r.role.toLowerCase() as HostelStaffAssignmentDto["role"], status: r.status.toLowerCase() as HostelStaffAssignmentDto["status"],
    assignedAt: r.assignedAt.toISOString(), endedAt: r.endedAt?.toISOString() ?? null, createdAt: r.createdAt.toISOString(),
  };
}

export async function listStaffAssignments(scope: OrgScope, params: { hostelId?: string; status?: string } = {}): Promise<HostelStaffAssignmentDto[]> {
  const where: Prisma.HostelStaffAssignmentWhereInput = { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
  if (params.hostelId) where.hostelId = params.hostelId;
  if (params.status) where.status = params.status.toUpperCase() as never;
  const rows = await prisma.hostelStaffAssignment.findMany({ where, select, orderBy: { assignedAt: "desc" } });
  return rows.map(dto);
}

async function requireStaffAssignmentInScope(scope: OrgScope, id: string): Promise<Row> {
  const row = await prisma.hostelStaffAssignment.findFirst({ where: { id, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select });
  if (!row) throw new HttpError("HOSTEL_STAFF_ASSIGNMENT_NOT_FOUND", "Assignment not found");
  return row;
}

export const assignHostelStaffSchema = z.object({ hostelId: z.string().min(1), staffId: z.string().min(1), role: z.enum(["warden", "assistant_warden"]).default("warden") });

export async function assignHostelStaff(scope: OrgScope, raw: unknown): Promise<HostelStaffAssignmentDto> {
  const input = parseInput(assignHostelStaffSchema, raw);
  const hostel = await requireHostelInScope(scope, input.hostelId);
  const staff = await prisma.staff.findFirst({ where: { id: input.staffId, schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true } });
  if (!staff) throw new HttpError("INVALID_HOSTEL_STAFF", "Warden must be a real, active staff member in this school");

  let id: string;
  try {
    id = await prisma.$transaction(async (tx) => {
      const row = await tx.hostelStaffAssignment.create({
        data: { tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: hostel.branchId, hostelId: input.hostelId, staffId: input.staffId, role: input.role.toUpperCase() as never },
        select: { id: true },
      });
      await recordAudit(tx, scope, "HOSTEL_STAFF_ASSIGNED", "HostelStaffAssignment", row.id, { hostelId: input.hostelId, staffId: input.staffId, role: input.role });
      return row.id;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new HttpError("HOSTEL_STAFF_ASSIGNMENT_EXISTS", "This staff member already holds this role for this hostel");
    throw e;
  }
  const row = await requireStaffAssignmentInScope(scope, id);
  return dto(row);
}

export async function endHostelStaffAssignment(scope: OrgScope, id: string): Promise<HostelStaffAssignmentDto> {
  const current = await requireStaffAssignmentInScope(scope, id);
  if (current.status !== "ACTIVE") throw new HttpError("VALIDATION_ERROR", "This assignment is already ended");
  await prisma.$transaction(async (tx) => {
    const updated = await tx.hostelStaffAssignment.updateMany({ where: { id, status: "ACTIVE" }, data: { status: "ENDED", endedAt: new Date() } });
    if (updated.count === 0) throw new HttpError("VALIDATION_ERROR", "This assignment is already ended");
    await recordAudit(tx, scope, "HOSTEL_STAFF_ASSIGNMENT_ENDED", "HostelStaffAssignment", id, { hostelId: current.hostelId, staffId: current.staffId });
  });
  return dto(await requireStaffAssignmentInScope(scope, id));
}
