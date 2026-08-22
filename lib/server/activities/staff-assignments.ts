// Activity Staff Assignments (Phase 9U) — coordinator/coach/mentor, always a
// real, active Staff.id. assign() is an upsert keyed on (activityId,
// staffId, role): reactivating a previously-ended assignment reuses the
// same row.
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { createNotification } from "@/lib/server/notifications/service";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { ActivityStaffAssignmentDto } from "@/lib/api/contracts";
import { requireValidStaff, staffDisplayName } from "./access";
import { requireActivityInScope } from "./activities";

function dto(r: { id: string; activityId: string; staffId: string; role: string; status: string; assignedAt: Date; endedAt: Date | null; staff: { firstName: string; lastName: string | null; displayName: string | null } }): ActivityStaffAssignmentDto {
  return {
    id: r.id, activityId: r.activityId, staffId: r.staffId, staffName: staffDisplayName(r.staff),
    role: r.role.toLowerCase() as ActivityStaffAssignmentDto["role"], status: r.status.toLowerCase() as ActivityStaffAssignmentDto["status"],
    assignedAt: r.assignedAt.toISOString(), endedAt: r.endedAt?.toISOString() ?? null,
  };
}

export async function listStaffAssignments(scope: OrgScope, activityId: string): Promise<ActivityStaffAssignmentDto[]> {
  await requireActivityInScope(scope, activityId);
  const rows = await prisma.activityStaffAssignment.findMany({
    where: { activityId },
    select: { id: true, activityId: true, staffId: true, role: true, status: true, assignedAt: true, endedAt: true, staff: { select: { firstName: true, lastName: true, displayName: true } } },
    orderBy: { assignedAt: "desc" },
  });
  return rows.map(dto);
}

export const assignStaffSchema = z.object({ staffId: z.string().min(1), role: z.enum(["coordinator", "coach", "mentor"]).default("coordinator") });

export async function assignStaff(scope: OrgScope, activityId: string, raw: unknown): Promise<ActivityStaffAssignmentDto> {
  const input = parseInput(assignStaffSchema, raw);
  const activity = await requireActivityInScope(scope, activityId);
  await requireValidStaff(scope, input.staffId);
  const roleDb = input.role.toUpperCase() as never;

  const id = await prisma.$transaction(async (tx) => {
    const row = await tx.activityStaffAssignment.upsert({
      where: { activityId_staffId_role: { activityId, staffId: input.staffId, role: roleDb } },
      create: { tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: activity.branchId, activityId, staffId: input.staffId, role: roleDb },
      update: { status: "ACTIVE", endedAt: null },
      select: { id: true },
    });
    await recordAudit(tx, scope, "ACTIVITY_STAFF_ASSIGNED", "ActivityStaffAssignment", row.id, { activityId, staffId: input.staffId, role: input.role });

    const staffUser = await tx.staff.findUnique({ where: { id: input.staffId }, select: { userId: true } });
    if (staffUser?.userId) {
      const activityRow = await tx.activity.findUniqueOrThrow({ where: { id: activityId }, select: { name: true } });
      await createNotification(tx, {
        tenantId: scope.tenantId, schoolId: scope.schoolId, type: "ACTIVITY_STAFF_ASSIGNED",
        title: "Activity assignment", body: `You have been assigned to ${activityRow.name}.`,
        href: "/activities/clubs", sourceType: "Activity", sourceId: activityId,
        dedupeKey: `ACTIVITY_STAFF_ASSIGNED:${activityId}:${input.staffId}:${input.role}`, recipientUserIds: [staffUser.userId],
      });
    }
    return row.id;
  });

  const row = await prisma.activityStaffAssignment.findUniqueOrThrow({
    where: { id },
    select: { id: true, activityId: true, staffId: true, role: true, status: true, assignedAt: true, endedAt: true, staff: { select: { firstName: true, lastName: true, displayName: true } } },
  });
  return dto(row);
}

export async function endStaffAssignment(scope: OrgScope, activityId: string, assignmentId: string): Promise<ActivityStaffAssignmentDto> {
  await requireActivityInScope(scope, activityId);
  const current = await prisma.activityStaffAssignment.findFirst({ where: { id: assignmentId, activityId }, select: { id: true, status: true } });
  if (!current) throw new HttpError("ACTIVITY_STAFF_ASSIGNMENT_NOT_FOUND", "Assignment not found");
  await prisma.$transaction(async (tx) => {
    const updated = await tx.activityStaffAssignment.updateMany({ where: { id: assignmentId, status: "ACTIVE" }, data: { status: "ENDED", endedAt: new Date() } });
    if (updated.count === 0) throw new HttpError("ACTIVITY_STAFF_ASSIGNMENT_NOT_FOUND", "Assignment is already ended");
    await recordAudit(tx, scope, "ACTIVITY_STAFF_ENDED", "ActivityStaffAssignment", assignmentId, {});
  });
  const row = await prisma.activityStaffAssignment.findUniqueOrThrow({
    where: { id: assignmentId },
    select: { id: true, activityId: true, staffId: true, role: true, status: true, assignedAt: true, endedAt: true, staff: { select: { firstName: true, lastName: true, displayName: true } } },
  });
  return dto(row);
}
