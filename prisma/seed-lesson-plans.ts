// Phase 9C.2 seed — real LessonPlans on the seeded TeachingAssignment, one per
// lifecycle stage (DRAFT, SUBMITTED, COMPLETED) so the demo has something real
// to walk through. Idempotent by (teachingAssignmentId, title).
import type { PrismaClient } from "../lib/generated/prisma/client";

type Ids = { tenantId: string; schoolId: string; branchId: string; academicSessionId: string };

export async function seedLessonPlans(prisma: PrismaClient, ids: Ids) {
  const { tenantId, schoolId, branchId, academicSessionId } = ids;

  const staff = await prisma.staff.findFirst({ where: { schoolId, employeeCode: "TCH-001" }, select: { id: true, userId: true, firstName: true, lastName: true } });
  const assignment = staff
    ? await prisma.teachingAssignment.findFirst({ where: { schoolId, academicSessionId, staffId: staff.id }, select: { id: true, sectionId: true, subjectId: true } })
    : null;

  if (!staff || !assignment || !staff.userId) {
    console.log(`  P9C2:     skipped (no real TeachingAssignment on a login-linked teacher yet)`);
    return;
  }

  const firstTopic = await prisma.curriculumTopic.findFirst({
    where: { chapter: { unit: { curriculum: { schoolId, academicSessionId, subjectId: assignment.subjectId } } } },
    orderBy: { order: "asc" },
    select: { id: true },
  });

  const PLANS: { title: string; plannedDate: Date; status: "DRAFT" | "SUBMITTED" | "COMPLETED"; withTopic?: boolean }[] = [
    { title: "Today's lesson — introduction", plannedDate: new Date("2026-08-15"), status: "DRAFT", withTopic: true },
    { title: "Next class — practice session", plannedDate: new Date("2026-08-18"), status: "SUBMITTED" },
    { title: "Prior week — recap lesson", plannedDate: new Date("2026-08-05"), status: "COMPLETED" },
  ];

  let created = 0;
  for (const p of PLANS) {
    const exists = await prisma.lessonPlan.findFirst({ where: { teachingAssignmentId: assignment.id, title: p.title }, select: { id: true } });
    if (exists) continue;
    const row = await prisma.lessonPlan.create({
      data: {
        tenantId, schoolId, branchId, academicSessionId,
        sectionId: assignment.sectionId, subjectId: assignment.subjectId, staffId: staff.id, teachingAssignmentId: assignment.id,
        title: p.title, learningObjective: "Students will understand the key concepts for this session.", teachingMethod: "Lecture + guided practice",
        plannedDate: p.plannedDate, period: 1, status: p.status,
        createdByUserId: staff.userId, createdByName: `${staff.firstName} ${staff.lastName}`,
        ...(p.status === "COMPLETED" ? { reviewedByUserId: staff.userId, reviewedByName: `${staff.firstName} ${staff.lastName}` } : {}),
      },
      select: { id: true },
    });
    if (p.withTopic && firstTopic) await prisma.lessonPlanTopic.create({ data: { lessonPlanId: row.id, topicId: firstTopic.id } });
    created++;
  }

  console.log(`  P9C2:     lessonPlans(+${created})`);
}
