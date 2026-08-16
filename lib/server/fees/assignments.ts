// Fee Assignment (Phase 9F) — the billing act. A FeeStructure by itself is
// not a student's debt; this creates the real StudentFeeAssignment + one
// FeeCharge per FeeStructureItem. Bulk targets (section/class) are resolved
// server-side to real ACTIVE Enrollment rows in the structure's own
// academicSessionId — a browser-supplied studentIds array is NEVER trusted as
// proof of class/section membership. Idempotent: re-running the same
// structure against the same target skips students who already have an
// ACTIVE assignment (DB-unique-constraint-backed, not just a pre-check).
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { AssignFeeStructureResultDto } from "@/lib/api/contracts";
import { isBroadFeeManager } from "./access";

function requireSession(scope: OrgScope): string {
  if (!scope.academicSessionId) throw new HttpError("INVALID_SESSION", "Select an academic session first");
  return scope.academicSessionId;
}

export const assignFeeStructureSchema = z.object({
  feeStructureId: z.string().min(1),
  target: z.discriminatedUnion("type", [
    z.object({ type: z.literal("student"), studentId: z.string().min(1) }),
    z.object({ type: z.literal("section"), sectionId: z.string().min(1) }),
    z.object({ type: z.literal("class"), classId: z.string().min(1) }),
  ]),
});

/** Real Enrollment-backed resolution of the target student set — never the
 * browser's word for who belongs to a class/section. */
async function resolveTargetStudentIds(scope: OrgScope, sessionId: string, target: z.infer<typeof assignFeeStructureSchema>["target"]): Promise<string[]> {
  if (target.type === "student") {
    const student = await prisma.student.findFirst({ where: { id: target.studentId, schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true } });
    if (!student) throw new HttpError("NOT_FOUND", "Student not found");
    return [student.id];
  }
  const where: Prisma.EnrollmentWhereInput = {
    schoolId: scope.schoolId, academicSessionId: sessionId, status: "ENROLLED",
    ...(target.type === "section" ? { sectionId: target.sectionId } : { classId: target.classId }),
  };
  const enrollments = await prisma.enrollment.findMany({ where, select: { studentId: true } });
  if (enrollments.length === 0) throw new HttpError("NOT_FOUND", target.type === "section" ? "Section not found or has no active enrollments" : "Class not found or has no active enrollments");
  return enrollments.map((e) => e.studentId);
}

export async function assignFeeStructure(scope: OrgScope, raw: unknown): Promise<AssignFeeStructureResultDto> {
  if (!(await isBroadFeeManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  const input = parseInput(assignFeeStructureSchema, raw);
  const sessionId = requireSession(scope);

  const structure = await prisma.feeStructure.findFirst({
    where: { id: input.feeStructureId, schoolId: scope.schoolId, academicSessionId: sessionId },
    select: { id: true, status: true, branchId: true, items: { select: { id: true, categoryId: true, category: { select: { name: true } }, name: true, amount: true, dueDate: true } } },
  });
  if (!structure) throw new HttpError("FEE_STRUCTURE_NOT_FOUND", "Fee structure not found");
  if (structure.status === "ARCHIVED") throw new HttpError("FEE_STRUCTURE_NOT_EDITABLE", "An archived structure cannot be assigned");
  if (structure.items.length === 0) throw new HttpError("INVALID_FEE_STRUCTURE", "This structure has no fee items yet");

  const studentIds = await resolveTargetStudentIds(scope, sessionId, input.target);

  // Real Enrollment for traceability (optional — an individual assignment
  // may not resolve through one; never re-validated after the fact).
  const enrollmentByStudent = new Map(
    (await prisma.enrollment.findMany({ where: { studentId: { in: studentIds }, academicSessionId: sessionId, status: "ENROLLED" }, select: { studentId: true, id: true } })).map((e) => [e.studentId, e.id]),
  );

  let assigned = 0, alreadyAssigned = 0;
  const ineligible: { studentId: string; reason: string }[] = [];

  await prisma.$transaction(async (tx) => {
    for (const studentId of studentIds) {
      const existing = await tx.studentFeeAssignment.findUnique({ where: { studentId_feeStructureId: { studentId, feeStructureId: structure.id } }, select: { id: true, status: true } });
      if (existing) {
        alreadyAssigned++;
        continue;
      }
      try {
        const assignment = await tx.studentFeeAssignment.create({
          data: {
            tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: structure.branchId, academicSessionId: sessionId,
            studentId, enrollmentId: enrollmentByStudent.get(studentId) ?? null, feeStructureId: structure.id,
            assignedByUserId: scope.actor.id, assignedByName: scope.actor.name,
          },
          select: { id: true },
        });
        await tx.feeCharge.createMany({
          data: structure.items.map((item) => ({
            tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: structure.branchId, academicSessionId: sessionId,
            assignmentId: assignment.id, studentId, feeStructureItemId: item.id,
            categoryName: item.category.name, itemName: item.name, amount: item.amount, dueDate: item.dueDate,
          })),
        });
        assigned++;
      } catch {
        // Unique-constraint race: another concurrent request assigned this
        // student first — counted as already-assigned, not an error.
        alreadyAssigned++;
      }
    }
    if (assigned > 0) await recordAudit(tx, scope, "FEE_ASSIGNED", "FeeStructure", structure.id, { assigned, target: input.target });
  });

  return { assigned, alreadyAssigned, ineligible };
}
