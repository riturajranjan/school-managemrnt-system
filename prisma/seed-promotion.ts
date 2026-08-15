// Phase 8E seed — the target-session academic foundation Promotion needs to
// exist for a demo/dev database. Idempotent: keyed by session code / class
// name / section name. Deliberately mirrors the SOURCE session's Class roster
// 1:1 into the target session (same names, same order) rather than shifting
// grade numbers — Promotion never assumes "Grade 1 -> Grade 2"; the admin
// picks a real target Class/Section explicitly, for BOTH promotion and
// retention, so the target session needs the full class list available, not
// a pre-decided "next grade" mapping.
import type { PrismaClient } from "../lib/generated/prisma/client";

type Ids = { tenantId: string; schoolId: string; branchId: string; academicSessionId: string };

export async function seedPromotionTargetSession(prisma: PrismaClient, ids: Ids) {
  const { tenantId, schoolId, branchId, academicSessionId: sourceSessionId } = ids;

  const targetSession = await prisma.academicSession.upsert({
    where: { schoolId_code: { schoolId, code: "2027-28" } },
    update: {},
    create: {
      schoolId, name: "2027–28", code: "2027-28",
      startDate: new Date("2027-04-01"), endDate: new Date("2028-03-31"),
      status: "UPCOMING", isCurrent: false,
    },
  });

  const sourceClasses = await prisma.class.findMany({ where: { schoolId, academicSessionId: sourceSessionId }, select: { name: true, order: true } });

  let classesCreated = 0;
  let sectionsCreated = 0;
  for (const cls of sourceClasses) {
    const existingClass = await prisma.class.findFirst({ where: { schoolId, academicSessionId: targetSession.id, name: cls.name }, select: { id: true } });
    const targetClassId = existingClass?.id ?? (await prisma.class.create({ data: { tenantId, schoolId, academicSessionId: targetSession.id, name: cls.name, order: cls.order }, select: { id: true } })).id;
    if (!existingClass) classesCreated++;

    const sourceClass = await prisma.class.findFirstOrThrow({ where: { schoolId, academicSessionId: sourceSessionId, name: cls.name }, select: { id: true } });
    const sourceSections = await prisma.section.findMany({ where: { classId: sourceClass.id }, select: { name: true, capacity: true } });
    for (const sec of sourceSections) {
      const existingSection = await prisma.section.findFirst({ where: { classId: targetClassId, name: sec.name }, select: { id: true } });
      if (existingSection) continue;
      await prisma.section.create({ data: { tenantId, schoolId, branchId, academicSessionId: targetSession.id, classId: targetClassId, name: sec.name, capacity: sec.capacity } });
      sectionsCreated++;
    }
  }

  console.log(`  Phase 8E: target session ${targetSession.name} ready — ${classesCreated} class(es), ${sectionsCreated} section(s) created`);
  return { targetSessionId: targetSession.id };
}
