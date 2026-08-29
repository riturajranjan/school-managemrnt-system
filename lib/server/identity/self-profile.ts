// Identity-based self-profile resolvers (Phase 9W.2) — for the STUDENT and
// GUARDIAN account-foundation landing pages. These deliberately do NOT use a
// permission check: STUDENT/GUARDIAN roles carry zero domain permissions by
// design (no portal exists yet), so access is scoped by identity instead
// (Student.userId === caller / Guardian.userId === caller), the same pattern
// already used elsewhere in this codebase for Staff self-service payslips.
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import type { AuthzContext } from "@/lib/server/authz/permissions";
import { requireOrgScope } from "@/lib/server/api/scope";
import { guardianRelationToUi, studentStatusToUi } from "@/lib/server/api/enums";
import type { MyProfileDto } from "@/lib/api/contracts";

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

/**
 * The caller's own real identity/profile — User plus whichever of
 * Staff/Student/Guardian is linked (a User has at most one). School/branch
 * come from the real, re-validated active org scope (requireOrgScope), never
 * from a stale UserActiveContext id — a pure platform admin with no active
 * school simply gets nulls back rather than an error, since this route must
 * work for every authenticated identity.
 */
export async function getMyProfile(ctx: AuthzContext): Promise<MyProfileDto> {
  const [user, staff, student, guardian] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: ctx.user.id }, select: { id: true, name: true, email: true, image: true } }),
    prisma.staff.findUnique({ where: { userId: ctx.user.id }, select: { employeeCode: true, phone: true, designation: true, department: true } }),
    prisma.student.findUnique({ where: { userId: ctx.user.id }, select: { phone: true, admissionNumber: true, photoUrl: true } }),
    prisma.guardian.findUnique({ where: { userId: ctx.user.id }, select: { phone: true, photoUrl: true } }),
  ]);

  let schoolName: string | null = null;
  let branchName: string | null = null;
  let schoolTimezone: string | null = null;
  let schoolLocale: string | null = null;
  let schoolCurrency: string | null = null;
  try {
    const scope = await requireOrgScope(ctx);
    const [school, branch] = await Promise.all([
      prisma.school.findUnique({ where: { id: scope.schoolId }, select: { name: true, timezone: true, locale: true, currency: true } }),
      scope.branchId ? prisma.branch.findUnique({ where: { id: scope.branchId }, select: { name: true } }) : Promise.resolve(null),
    ]);
    schoolName = school?.name ?? null;
    branchName = branch?.name ?? null;
    schoolTimezone = school?.timezone ?? null;
    schoolLocale = school?.locale ?? null;
    schoolCurrency = school?.currency ?? null;
  } catch {
    // No active school selected (e.g. a pure platform admin) — leave blank.
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image ?? student?.photoUrl ?? guardian?.photoUrl ?? null,
    phone: staff?.phone ?? student?.phone ?? guardian?.phone ?? null,
    idLabel: staff ? "Employee ID" : student ? "Admission No." : null,
    idValue: staff?.employeeCode ?? student?.admissionNumber ?? null,
    designation: staff?.designation ?? null,
    department: staff?.department ?? null,
    schoolName,
    branchName,
    schoolTimezone,
    schoolLocale,
    schoolCurrency,
  };
}
