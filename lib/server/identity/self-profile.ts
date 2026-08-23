// Identity-based self-profile resolvers (Phase 9W.2) — for the STUDENT and
// GUARDIAN account-foundation landing pages. These deliberately do NOT use a
// permission check: STUDENT/GUARDIAN roles carry zero domain permissions by
// design (no portal exists yet), so access is scoped by identity instead
// (Student.userId === caller / Guardian.userId === caller), the same pattern
// already used elsewhere in this codebase for Staff self-service payslips.
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { guardianRelationToUi, studentStatusToUi } from "@/lib/server/api/enums";

export type MyStudentProfile = {
  id: string;
  name: string;
  admissionNumber: string;
  classLabel: string | null;
  sectionLabel: string | null;
  status: string;
};

/** The real Student record linked to this User, or null if this user has no Student link. */
export async function getMyStudentProfile(userId: string): Promise<MyStudentProfile | null> {
  const student = await prisma.student.findUnique({
    where: { userId },
    select: { id: true, firstName: true, lastName: true, admissionNumber: true, classLabel: true, sectionLabel: true, status: true },
  });
  if (!student) return null;
  return {
    id: student.id,
    name: `${student.firstName} ${student.lastName}`.trim(),
    admissionNumber: student.admissionNumber,
    classLabel: student.classLabel,
    sectionLabel: student.sectionLabel,
    status: studentStatusToUi[student.status],
  };
}

export type MyGuardianChild = {
  id: string;
  name: string;
  admissionNumber: string;
  classLabel: string | null;
  sectionLabel: string | null;
  status: string;
  relation: string;
};

/** The real children of the Guardian linked to this User (via real StudentGuardian rows), or null if unlinked. */
export async function getMyGuardianChildren(userId: string): Promise<MyGuardianChild[] | null> {
  const guardian = await prisma.guardian.findUnique({
    where: { userId },
    select: {
      id: true,
      students: {
        select: {
          relation: true,
          student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true, classLabel: true, sectionLabel: true, status: true } },
        },
      },
    },
  });
  if (!guardian) return null;
  return guardian.students.map((l) => ({
    id: l.student.id,
    name: `${l.student.firstName} ${l.student.lastName}`.trim(),
    admissionNumber: l.student.admissionNumber,
    classLabel: l.student.classLabel,
    sectionLabel: l.student.sectionLabel,
    status: studentStatusToUi[l.student.status],
    relation: guardianRelationToUi[l.relation],
  }));
}

export function assertLinked<T>(value: T | null, message: string): T {
  if (value === null) throw new HttpError("NOT_FOUND", message);
  return value;
}
