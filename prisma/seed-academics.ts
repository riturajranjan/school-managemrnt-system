// Phase 6-pre seed — real Class/Section/Enrollment derived from the real seeded
// Students' denormalized classLabel/sectionLabel (Phase 4). Idempotent: keyed by
// class name / section name / (session, student). Enrolls ACTIVE students only.
import type { PrismaClient } from "../lib/generated/prisma/client";

type Ids = { tenantId: string; schoolId: string; branchId: string; academicSessionId: string };

function classOrder(name: string): number {
  const n = Number(name.replace(/[^0-9]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 999;
}

export async function seedAcademics(prisma: PrismaClient, ids: Ids) {
  const { tenantId, schoolId, branchId, academicSessionId } = ids;

  const students = await prisma.student.findMany({
    where: { schoolId, academicSessionId, classLabel: { not: null }, sectionLabel: { not: null } },
    select: { id: true, classLabel: true, sectionLabel: true, rollNumber: true, status: true },
  });

  // Distinct class labels → real Class rows.
  const classNames = [...new Set(students.map((s) => s.classLabel!))].sort((a, b) => classOrder(a) - classOrder(b));
  const classByName = new Map<string, string>();
  let classesCreated = 0;
  for (const name of classNames) {
    const existing = await prisma.class.findFirst({ where: { schoolId, academicSessionId, name }, select: { id: true } });
    const id = existing?.id ?? (await prisma.class.create({ data: { tenantId, schoolId, academicSessionId, name, order: classOrder(name) }, select: { id: true } })).id;
    if (!existing) classesCreated++;
    classByName.set(name, id);
  }

  // Distinct (class, section) → real Section rows.
  const sectionKey = (c: string, s: string) => `${c}::${s}`;
  const sectionByKey = new Map<string, string>();
  let sectionsCreated = 0;
  for (const { classLabel, sectionLabel } of students) {
    const key = sectionKey(classLabel!, sectionLabel!);
    if (sectionByKey.has(key)) continue;
    const classId = classByName.get(classLabel!)!;
    const existing = await prisma.section.findFirst({ where: { classId, name: sectionLabel! }, select: { id: true } });
    const id = existing?.id ?? (await prisma.section.create({ data: { tenantId, schoolId, branchId, academicSessionId, classId, name: sectionLabel!, capacity: 40 }, select: { id: true } })).id;
    if (!existing) sectionsCreated++;
    sectionByKey.set(key, id);
  }

  // Enroll ACTIVE students into their section (one enrollment per student/session).
  let enrolled = 0;
  for (const s of students) {
    if (s.status !== "ACTIVE") continue;
    const already = await prisma.enrollment.findFirst({ where: { academicSessionId, studentId: s.id }, select: { id: true } });
    if (already) continue;
    const classId = classByName.get(s.classLabel!)!;
    const sectionId = sectionByKey.get(sectionKey(s.classLabel!, s.sectionLabel!))!;
    await prisma.enrollment.create({
      data: { tenantId, schoolId, branchId, academicSessionId, classId, sectionId, studentId: s.id, rollNumber: s.rollNumber, status: "ENROLLED" },
    });
    enrolled++;
  }

  const [classTotal, sectionTotal, enrollTotal] = await Promise.all([prisma.class.count(), prisma.section.count(), prisma.enrollment.count()]);
  console.log(`  P6pre:    Class=${classTotal} (+${classesCreated}) Section=${sectionTotal} (+${sectionsCreated}) Enrollment=${enrollTotal} (+${enrolled})`);
}
