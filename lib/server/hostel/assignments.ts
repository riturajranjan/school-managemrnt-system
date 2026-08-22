// Student Hostel Assignment: allocate / transfer / vacate (Phase 9Q). A
// resident is always a real, active Student.id in this school. Concurrency
// safety is belt-and-suspenders: a pre-check for a friendly error message,
// backed by two partial unique indexes (bedId WHERE ACTIVE;
// (studentId, academicSessionId) WHERE ACTIVE) that make the actual DB
// guarantee real under a true race — mirrors Phase 9N/9O's dual-guard
// pattern. History is append-only: vacate/transfer never delete or rewrite a
// row, only close it (VACATED/TRANSFERRED) and — for a transfer — create a
// new ACTIVE row in the same transaction.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { HostelAssignmentDto } from "@/lib/api/contracts";
import { studentDisplayName } from "./access";

type Row = {
  id: string; studentId: string; hostelId: string; roomId: string; bedId: string; academicSessionId: string;
  assignedAt: Date; vacatedAt: Date | null; status: string; notes: string | null; createdAt: Date; updatedAt: Date;
  student: { firstName: string; lastName: string | null; admissionNumber: string };
  hostel: { name: string };
  room: { roomNumber: string };
  bed: { bedNumber: string };
};

const select = {
  id: true, studentId: true, hostelId: true, roomId: true, bedId: true, academicSessionId: true,
  assignedAt: true, vacatedAt: true, status: true, notes: true, createdAt: true, updatedAt: true,
  student: { select: { firstName: true, lastName: true, admissionNumber: true } },
  hostel: { select: { name: true } },
  room: { select: { roomNumber: true } },
  bed: { select: { bedNumber: true } },
} satisfies Prisma.StudentHostelAssignmentSelect;

function dto(a: Row): HostelAssignmentDto {
  return {
    id: a.id, studentId: a.studentId, studentName: studentDisplayName(a.student), admissionNumber: a.student.admissionNumber,
    hostelId: a.hostelId, hostelName: a.hostel.name, roomId: a.roomId, roomNumber: a.room.roomNumber, bedId: a.bedId, bedNumber: a.bed.bedNumber,
    academicSessionId: a.academicSessionId, assignedAt: a.assignedAt.toISOString(), vacatedAt: a.vacatedAt?.toISOString() ?? null,
    status: a.status.toLowerCase() as HostelAssignmentDto["status"], notes: a.notes,
    createdAt: a.createdAt.toISOString(), updatedAt: a.updatedAt.toISOString(),
  };
}

export async function listAssignments(scope: OrgScope, params: { hostelId?: string; roomId?: string; studentId?: string; status?: string } = {}): Promise<HostelAssignmentDto[]> {
  const where: Prisma.StudentHostelAssignmentWhereInput = { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
  if (params.hostelId) where.hostelId = params.hostelId;
  if (params.roomId) where.roomId = params.roomId;
  if (params.studentId) where.studentId = params.studentId;
  if (params.status) where.status = params.status.toUpperCase() as never;
  const rows = await prisma.studentHostelAssignment.findMany({ where, select, orderBy: { createdAt: "desc" } });
  return rows.map(dto);
}

async function requireAssignmentInScope(scope: OrgScope, assignmentId: string): Promise<Row> {
  const row = await prisma.studentHostelAssignment.findFirst({ where: { id: assignmentId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select });
  if (!row) throw new HttpError("HOSTEL_ASSIGNMENT_NOT_FOUND", "Assignment not found");
  return row;
}

export async function getAssignment(scope: OrgScope, assignmentId: string): Promise<HostelAssignmentDto> {
  return dto(await requireAssignmentInScope(scope, assignmentId));
}

async function requireEligibleStudent(scope: OrgScope, studentId: string): Promise<{ id: string }> {
  const student = await prisma.student.findFirst({ where: { id: studentId, schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true } });
  if (!student) throw new HttpError("INVALID_HOSTEL_STUDENT", "Resident must be a real, active student in this school");
  return student;
}

async function requireAvailableBed(scope: OrgScope, bedId: string): Promise<{ id: string; roomId: string; hostelId: string; branchId: string }> {
  const bed = await prisma.hostelBed.findFirst({
    where: { id: bedId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) },
    select: { id: true, roomId: true, branchId: true, status: true, room: { select: { hostelId: true, status: true } } },
  });
  if (!bed) throw new HttpError("HOSTEL_BED_NOT_FOUND", "Bed not found");
  if (bed.status !== "ACTIVE" || bed.room.status === "ARCHIVED") throw new HttpError("HOSTEL_BED_NOT_AVAILABLE", "This bed is not available");
  const activeOccupant = await prisma.studentHostelAssignment.findFirst({ where: { bedId, status: "ACTIVE" }, select: { id: true } });
  if (activeOccupant) throw new HttpError("HOSTEL_BED_NOT_AVAILABLE", "This bed is already occupied");
  return { id: bed.id, roomId: bed.roomId, hostelId: bed.room.hostelId, branchId: bed.branchId };
}

export const assignStudentSchema = z.object({ studentId: z.string().min(1), bedId: z.string().min(1), notes: z.string().trim().max(300).optional() });

export async function assignStudent(scope: OrgScope, raw: unknown): Promise<HostelAssignmentDto> {
  const input = parseInput(assignStudentSchema, raw);
  if (!scope.academicSessionId) throw new HttpError("INVALID_SESSION", "An academic session must be selected");
  await requireEligibleStudent(scope, input.studentId);
  const bed = await requireAvailableBed(scope, input.bedId);

  const existingActive = await prisma.studentHostelAssignment.findFirst({ where: { studentId: input.studentId, academicSessionId: scope.academicSessionId, status: "ACTIVE" }, select: { id: true } });
  if (existingActive) throw new HttpError("HOSTEL_STUDENT_ALREADY_ASSIGNED", "This student already has an active hostel assignment this session");

  try {
    const assignmentId = await prisma.$transaction(async (tx) => {
      const row = await tx.studentHostelAssignment.create({
        data: {
          tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: bed.branchId, academicSessionId: scope.academicSessionId!,
          studentId: input.studentId, hostelId: bed.hostelId, roomId: bed.roomId, bedId: bed.id,
          assignedByUserId: scope.actor.id, notes: input.notes,
        },
        select: { id: true },
      });
      await recordAudit(tx, scope, "HOSTEL_STUDENT_ASSIGNED", "StudentHostelAssignment", row.id, { studentId: input.studentId, bedId: bed.id });
      return row.id;
    });
    return getAssignment(scope, assignmentId);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      // Both partial-unique index names share a "student_hostel_assignments"
      // prefix, so disambiguate on "session" (only present in the
      // student+session index name), not "student".
      const target = JSON.stringify(e.meta?.target ?? "");
      if (target.includes("session")) throw new HttpError("HOSTEL_STUDENT_ALREADY_ASSIGNED", "This student already has an active hostel assignment this session");
      throw new HttpError("HOSTEL_BED_NOT_AVAILABLE", "This bed is already occupied");
    }
    throw e;
  }
}

export async function vacateAssignment(scope: OrgScope, assignmentId: string): Promise<HostelAssignmentDto> {
  const assignment = await requireAssignmentInScope(scope, assignmentId);
  if (assignment.status !== "ACTIVE") throw new HttpError("HOSTEL_ASSIGNMENT_ALREADY_CLOSED", "This assignment is not active");
  await prisma.$transaction(async (tx) => {
    const now = new Date();
    const updated = await tx.studentHostelAssignment.updateMany({ where: { id: assignmentId, status: "ACTIVE" }, data: { status: "VACATED", vacatedAt: now, vacatedByUserId: scope.actor.id } });
    if (updated.count === 0) throw new HttpError("HOSTEL_ASSIGNMENT_ALREADY_CLOSED", "This assignment is not active");
    await recordAudit(tx, scope, "HOSTEL_STUDENT_VACATED", "StudentHostelAssignment", assignmentId, { studentId: assignment.studentId, bedId: assignment.bedId });
  });
  return getAssignment(scope, assignmentId);
}

export const transferAssignmentSchema = z.object({ toBedId: z.string().min(1), notes: z.string().trim().max(300).optional() });

export async function transferAssignment(scope: OrgScope, assignmentId: string, raw: unknown): Promise<HostelAssignmentDto> {
  const input = parseInput(transferAssignmentSchema, raw);
  const current = await requireAssignmentInScope(scope, assignmentId);
  if (current.status !== "ACTIVE") throw new HttpError("HOSTEL_ASSIGNMENT_ALREADY_CLOSED", "This assignment is not active");
  if (input.toBedId === current.bedId) throw new HttpError("VALIDATION_ERROR", "Target bed must be different from the current bed");
  const targetBed = await requireAvailableBed(scope, input.toBedId);

  try {
    const newAssignmentId = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const closed = await tx.studentHostelAssignment.updateMany({ where: { id: assignmentId, status: "ACTIVE" }, data: { status: "TRANSFERRED", vacatedAt: now, vacatedByUserId: scope.actor.id } });
      if (closed.count === 0) throw new HttpError("HOSTEL_ASSIGNMENT_ALREADY_CLOSED", "This assignment is not active");

      const created = await tx.studentHostelAssignment.create({
        data: {
          tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: targetBed.branchId, academicSessionId: current.academicSessionId,
          studentId: current.studentId, hostelId: targetBed.hostelId, roomId: targetBed.roomId, bedId: targetBed.id,
          assignedByUserId: scope.actor.id, notes: input.notes,
        },
        select: { id: true },
      });
      await recordAudit(tx, scope, "HOSTEL_STUDENT_TRANSFERRED", "StudentHostelAssignment", created.id, { studentId: current.studentId, fromBedId: current.bedId, toBedId: targetBed.id });
      return created.id;
    });
    return getAssignment(scope, newAssignmentId);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new HttpError("HOSTEL_BED_NOT_AVAILABLE", "The target bed was just taken — retry");
    throw e;
  }
}
