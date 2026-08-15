// Phase 9C.1 seed — a real ACTIVE Curriculum on the seeded TeachingAssignment's
// real (Class, Subject), with 2 real Units -> Chapters -> Topics and some
// section-scoped progress, so the Curriculum page has something real to demo.
// Idempotent: curriculum keyed by (schoolId, academicSessionId, classId,
// subjectId); units/chapters/topics keyed by (parentId, order).
import type { PrismaClient } from "../lib/generated/prisma/client";

type Ids = { tenantId: string; schoolId: string; branchId: string; academicSessionId: string };

export async function seedCurriculum(prisma: PrismaClient, ids: Ids) {
  const { tenantId, schoolId, academicSessionId } = ids;

  const staff = await prisma.staff.findFirst({ where: { schoolId, employeeCode: "TCH-001" }, select: { id: true, userId: true, firstName: true, lastName: true } });
  const assignment = staff
    ? await prisma.teachingAssignment.findFirst({ where: { schoolId, academicSessionId, staffId: staff.id }, select: { id: true, sectionId: true, subjectId: true, section: { select: { classId: true, branchId: true } } } })
    : null;

  if (!staff || !assignment) {
    console.log(`  P9C1:     skipped (no real TeachingAssignment yet)`);
    return;
  }
  const classId = assignment.section.classId;
  const subjectId = assignment.subjectId;

  let curriculum = await prisma.curriculum.findUnique({ where: { schoolId_academicSessionId_classId_subjectId: { schoolId, academicSessionId, classId, subjectId } }, select: { id: true, status: true } });
  let curriculumCreated = false;
  if (!curriculum) {
    curriculum = await prisma.curriculum.create({
      data: { tenantId, schoolId, academicSessionId, classId, subjectId, title: "Term 1 syllabus", status: "ACTIVE", createdByUserId: staff.userId ?? "seed", createdByName: `${staff.firstName} ${staff.lastName}` },
      select: { id: true, status: true },
    });
    curriculumCreated = true;
  } else if (curriculum.status === "DRAFT") {
    curriculum = await prisma.curriculum.update({ where: { id: curriculum.id }, data: { status: "ACTIVE" }, select: { id: true, status: true } });
  }

  const UNITS = [
    { title: "Foundations", order: 0, estimatedPeriods: 8, plannedEnd: new Date("2026-08-10"), chapters: [{ title: "Chapter 1: Getting started", order: 0, topics: ["Key vocabulary", "Core concept overview"] }, { title: "Chapter 2: Building blocks", order: 1, topics: ["Worked example", "Guided practice"] }] },
    { title: "Core Concepts", order: 1, estimatedPeriods: 10, plannedEnd: new Date("2026-09-15"), chapters: [{ title: "Chapter 1: Deeper application", order: 0, topics: ["Applied problem set", "Peer review activity"] }] },
  ];

  let unitsCreated = 0, chaptersCreated = 0, topicsCreated = 0;
  for (const u of UNITS) {
    let unit = await prisma.curriculumUnit.findFirst({ where: { curriculumId: curriculum.id, order: u.order }, select: { id: true } });
    if (!unit) {
      unit = await prisma.curriculumUnit.create({ data: { curriculumId: curriculum.id, title: u.title, order: u.order, estimatedPeriods: u.estimatedPeriods, plannedEnd: u.plannedEnd }, select: { id: true } });
      unitsCreated++;
    }
    for (const c of u.chapters) {
      let chapter = await prisma.curriculumChapter.findFirst({ where: { unitId: unit.id, order: c.order }, select: { id: true } });
      if (!chapter) {
        chapter = await prisma.curriculumChapter.create({ data: { unitId: unit.id, title: c.title, order: c.order }, select: { id: true } });
        chaptersCreated++;
      }
      for (let i = 0; i < c.topics.length; i++) {
        const exists = await prisma.curriculumTopic.findFirst({ where: { chapterId: chapter.id, order: i }, select: { id: true } });
        if (exists) continue;
        await prisma.curriculumTopic.create({ data: { chapterId: chapter.id, title: c.topics[i], order: i, learningOutcomes: [`Explain ${c.topics[i].toLowerCase()}`] } });
        topicsCreated++;
      }
    }
  }
  console.log(`  P9C1:     curriculum(+${curriculumCreated ? 1 : 0}) units(+${unitsCreated}) chapters(+${chaptersCreated}) topics(+${topicsCreated})`);

  // Progress: mark the first unit's first chapter's first topic COMPLETED for
  // the real section, so the timeline demos a real in-progress state.
  const firstTopic = await prisma.curriculumTopic.findFirst({ where: { chapter: { unit: { curriculumId: curriculum.id, order: 0 }, order: 0 } }, orderBy: { order: "asc" }, select: { id: true } });
  let progressCreated = false;
  if (firstTopic) {
    const existing = await prisma.curriculumTopicProgress.findUnique({ where: { sectionId_topicId: { sectionId: assignment.sectionId, topicId: firstTopic.id } }, select: { id: true } });
    if (!existing) {
      await prisma.curriculumTopicProgress.create({
        data: { tenantId, schoolId, branchId: assignment.section.branchId, academicSessionId, sectionId: assignment.sectionId, topicId: firstTopic.id, status: "COMPLETED", completedAt: new Date(), completedByStaffId: staff.id },
      });
      progressCreated = true;
    }
  }
  console.log(`  P9C1:     progress(+${progressCreated ? 1 : 0})`);
}
