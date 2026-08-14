// Phase 6A seed — a small, real teaching Staff set on the seeded school/branch,
// plus a few real TeachingAssignments on real sections + inherited subjects.
// Idempotent: staff keyed by (schoolId, employeeCode); assignments by
// (sectionId, subjectId, staffId). Links the demo teacher User to one Staff row.
import type { PrismaClient } from "../lib/generated/prisma/client";

type Ids = { tenantId: string; schoolId: string; branchId: string; academicSessionId: string };

type StaffSeed = { code: string; firstName: string; lastName: string; designation: string; department: string; linkEmail?: string };

const STAFF: StaffSeed[] = [
  { code: "TCH-001", firstName: "Tarun", lastName: "Teacher", designation: "Senior Teacher", department: "Mathematics", linkEmail: "teacher@novyra-demo.example" },
  { code: "TCH-002", firstName: "Nisha", lastName: "Rao", designation: "Teacher", department: "Science" },
  { code: "TCH-003", firstName: "Arjun", lastName: "Mehta", designation: "Teacher", department: "Languages" },
  { code: "TCH-004", firstName: "Fatima", lastName: "Khan", designation: "Teacher", department: "Humanities" },
];

export async function seedStaff(prisma: PrismaClient, ids: Ids) {
  const { tenantId, schoolId, branchId, academicSessionId } = ids;

  // 1) Teaching staff (idempotent).
  const idByCode = new Map<string, string>();
  let created = 0;
  for (const s of STAFF) {
    const existing = await prisma.staff.findFirst({ where: { schoolId, employeeCode: s.code }, select: { id: true } });
    if (existing) { idByCode.set(s.code, existing.id); continue; }
    let userId: string | null = null;
    if (s.linkEmail) {
      const u = await prisma.user.findUnique({ where: { email: s.linkEmail }, select: { id: true } });
      // Only link if not already linked to another staff row.
      if (u && !(await prisma.staff.findFirst({ where: { userId: u.id }, select: { id: true } }))) userId = u.id;
    }
    const row = await prisma.staff.create({
      data: {
        tenantId, schoolId, branchId, employeeCode: s.code, firstName: s.firstName, lastName: s.lastName,
        designation: s.designation, department: s.department, isTeaching: true, status: "ACTIVE",
        employmentType: "FULL_TIME", userId,
      },
      select: { id: true },
    });
    idByCode.set(s.code, row.id);
    created++;
  }

  // 2) A few teaching assignments on the first section (in-branch) that has subjects.
  let assignments = 0;
  const section = await prisma.section.findFirst({
    where: { schoolId, academicSessionId, branchId, class: { classSubjects: { some: {} } } },
    select: { id: true, classId: true },
  });
  if (section) {
    const classSubjects = await prisma.classSubject.findMany({ where: { classId: section.classId }, orderBy: { order: "asc" }, select: { subjectId: true }, take: 3 });
    const staffIds = [...idByCode.values()];
    for (let i = 0; i < classSubjects.length && i < staffIds.length; i++) {
      const subjectId = classSubjects[i].subjectId;
      const staffId = staffIds[i];
      const exists = await prisma.teachingAssignment.findUnique({ where: { sectionId_subjectId_staffId: { sectionId: section.id, subjectId, staffId } }, select: { id: true } });
      if (exists) continue;
      await prisma.teachingAssignment.create({
        data: { tenantId, schoolId, branchId, academicSessionId, sectionId: section.id, subjectId, staffId, isPrimary: true },
      });
      assignments++;
    }
  }

  console.log(`  P6A:      ${created} staff created (${STAFF.length} total), ${assignments} teaching assignments`);
}
