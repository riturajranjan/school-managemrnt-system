// Nightly Hostel Roll Call (Phase 9Q) — a SEPARATE domain from academic
// AttendanceSession/AttendanceRecord. A resident with no record for a date
// is NOT_MARKED — never synthesized as ABSENT, matching Phase 9E's Staff
// Attendance convention. No biometric/access-control integration.
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { HostelRollCallEntryDto } from "@/lib/api/contracts";
import { studentDisplayName } from "./access";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");
const parseDate = (d: string) => new Date(`${d}T00:00:00.000Z`);

/** Roll call for all currently-active residents on a given date. hostelId
 * optionally scopes to one hostel. */
export async function getRollCall(scope: OrgScope, params: { date: string; hostelId?: string }): Promise<HostelRollCallEntryDto[]> {
  const input = parseInput(z.object({ date: dateStr, hostelId: z.string().optional() }), params);
  const activeAssignments = await prisma.studentHostelAssignment.findMany({
    where: { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}), status: "ACTIVE", ...(input.hostelId ? { hostelId: input.hostelId } : {}) },
    select: {
      studentId: true, hostelId: true, roomId: true, bedId: true,
      student: { select: { firstName: true, lastName: true, admissionNumber: true } },
      hostel: { select: { name: true } },
      room: { select: { roomNumber: true } },
      bed: { select: { bedNumber: true } },
    },
    orderBy: { student: { firstName: "asc" } },
  });
  const records = await prisma.hostelRollCallRecord.findMany({
    where: { schoolId: scope.schoolId, date: parseDate(input.date), studentId: { in: activeAssignments.map((a) => a.studentId) } },
    select: { studentId: true, status: true, notes: true, id: true },
  });
  const byStudent = new Map(records.map((r) => [r.studentId, r]));

  return activeAssignments.map((a) => {
    const r = byStudent.get(a.studentId);
    return {
      studentId: a.studentId, studentName: studentDisplayName(a.student), admissionNumber: a.student.admissionNumber,
      hostelId: a.hostelId, hostelName: a.hostel.name, roomNumber: a.room.roomNumber, bedNumber: a.bed.bedNumber,
      status: r ? (r.status.toLowerCase() as HostelRollCallEntryDto["status"]) : "not-marked",
      recordId: r?.id ?? null, notes: r?.notes ?? null,
    };
  });
}

export const markRollCallSchema = z.object({
  studentId: z.string().min(1),
  date: dateStr,
  status: z.enum(["present", "absent", "on_leave"]),
  notes: z.string().trim().max(300).optional(),
});

export async function markRollCall(scope: OrgScope, raw: unknown): Promise<{ studentId: string; date: string; status: string }> {
  const input = parseInput(markRollCallSchema, raw);
  const assignment = await prisma.studentHostelAssignment.findFirst({
    where: { studentId: input.studentId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}), status: "ACTIVE" },
    select: { hostelId: true, branchId: true, tenantId: true },
  });
  if (!assignment) throw new HttpError("INVALID_HOSTEL_STUDENT", "This student has no active hostel assignment");

  await prisma.hostelRollCallRecord.upsert({
    where: { studentId_date: { studentId: input.studentId, date: parseDate(input.date) } },
    create: {
      tenantId: assignment.tenantId, schoolId: scope.schoolId, branchId: assignment.branchId, studentId: input.studentId,
      hostelId: assignment.hostelId, date: parseDate(input.date), status: input.status.toUpperCase() as never,
      markedByUserId: scope.actor.id, notes: input.notes,
    },
    update: { status: input.status.toUpperCase() as never, notes: input.notes, markedByUserId: scope.actor.id },
  });
  await recordAudit(prisma, scope, "HOSTEL_ROLL_CALL_MARKED", "HostelRollCallRecord", input.studentId, { date: input.date, status: input.status });
  return { studentId: input.studentId, date: input.date, status: input.status };
}

export async function getStudentRollCallHistory(scope: OrgScope, studentId: string, limit = 30): Promise<{ date: string; status: string }[]> {
  const rows = await prisma.hostelRollCallRecord.findMany({
    where: { studentId, schoolId: scope.schoolId },
    select: { date: true, status: true },
    orderBy: { date: "desc" },
    take: limit,
  });
  return rows.map((r) => ({ date: r.date.toISOString().slice(0, 10), status: r.status.toLowerCase() }));
}
