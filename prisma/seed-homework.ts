// Phase 9B seed — real Homework on the seeded TeachingAssignment (Tarun
// Teacher / TCH-001, linked to teacher@novyra-demo.example), so the teacher
// login has something real to demo: one DRAFT, one PUBLISHED, one CLOSED.
// Idempotent by (teachingAssignmentId, title).
import type { PrismaClient } from "../lib/generated/prisma/client";

type Ids = { tenantId: string; schoolId: string; branchId: string; academicSessionId: string };

export async function seedHomework(prisma: PrismaClient, ids: Ids) {
  const { tenantId, schoolId, branchId, academicSessionId } = ids;

  const staff = await prisma.staff.findFirst({ where: { schoolId, employeeCode: "TCH-001" }, select: { id: true, userId: true, firstName: true, lastName: true } });
  const assignment = staff
    ? await prisma.teachingAssignment.findFirst({
        where: { schoolId, academicSessionId, staffId: staff.id },
        select: { id: true, sectionId: true, subjectId: true },
      })
    : null;

  if (!staff || !assignment || !staff.userId) {
    console.log(`  P9B:      skipped (no real TeachingAssignment on a login-linked teacher yet)`);
    return;
  }

  const HOMEWORK: { title: string; description: string; dueAt: Date; status: "DRAFT" | "PUBLISHED" | "CLOSED" }[] = [
    { title: "Chapter revision worksheet", description: "Draft worksheet — still being put together.", dueAt: new Date("2026-08-22"), status: "DRAFT" },
    { title: "Weekly practice problems", description: "Ten practice problems covering this week's topics.", dueAt: new Date("2026-08-20"), status: "PUBLISHED" },
    { title: "Unit recap questions", description: "Short recap questions from last unit.", dueAt: new Date("2026-08-10"), status: "CLOSED" },
  ];

  let created = 0;
  for (const h of HOMEWORK) {
    const exists = await prisma.homework.findFirst({ where: { teachingAssignmentId: assignment.id, title: h.title }, select: { id: true } });
    if (exists) continue;
    await prisma.homework.create({
      data: {
        tenantId, schoolId, branchId, academicSessionId,
        sectionId: assignment.sectionId, subjectId: assignment.subjectId, staffId: staff.id, teachingAssignmentId: assignment.id,
        title: h.title, description: h.description, dueAt: h.dueAt, status: h.status,
        createdByUserId: staff.userId, createdByName: `${staff.firstName} ${staff.lastName}`,
      },
    });
    created++;
  }

  console.log(`  P9B:      homework(+${created})`);
}
