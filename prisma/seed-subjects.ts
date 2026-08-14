// Phase 6 seed — a small, real Subject catalogue (school-scoped) plus real
// ClassSubject assignments onto the already-seeded Class rows. Idempotent:
// subjects keyed by (schoolId, code); assignments keyed by (classId, subjectId).
// Uses real Classes only — never fabricated ids. Assumes seedAcademics ran first.
import type { PrismaClient } from "../lib/generated/prisma/client";

type Ids = { tenantId: string; schoolId: string; branchId: string; academicSessionId: string };

type SubjectSeed = {
  code: string; name: string; shortName: string; department: string;
  type: "CORE" | "ELECTIVE" | "OPTIONAL" | "PRACTICAL" | "LANGUAGE" | "CO_CURRICULAR";
  color: string; gradeRangeStart: number; gradeRangeEnd: number;
};

const CATALOGUE: SubjectSeed[] = [
  { code: "ENG", name: "English", shortName: "ENG", department: "Languages", type: "LANGUAGE", color: "#18b0c8", gradeRangeStart: 1, gradeRangeEnd: 12 },
  { code: "MATH", name: "Mathematics", shortName: "MATH", department: "Mathematics", type: "CORE", color: "#6366f1", gradeRangeStart: 1, gradeRangeEnd: 12 },
  { code: "SCI", name: "Science", shortName: "SCI", department: "Science", type: "CORE", color: "#22c55e", gradeRangeStart: 1, gradeRangeEnd: 10 },
  { code: "SST", name: "Social Science", shortName: "SST", department: "Humanities", type: "CORE", color: "#f59e0b", gradeRangeStart: 1, gradeRangeEnd: 10 },
  { code: "HIN", name: "Hindi", shortName: "HIN", department: "Languages", type: "LANGUAGE", color: "#ec4899", gradeRangeStart: 1, gradeRangeEnd: 10 },
  { code: "CS", name: "Computer Science", shortName: "CS", department: "Computer Science", type: "ELECTIVE", color: "#0ea5e9", gradeRangeStart: 6, gradeRangeEnd: 12 },
];

// Which subject codes every class gets (core five); CS added for higher classes.
const CORE_CODES = ["ENG", "MATH", "SCI", "SST", "HIN"];

function classGrade(name: string): number {
  const n = Number(name.replace(/[^0-9]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export async function seedSubjects(prisma: PrismaClient, ids: Ids) {
  const { tenantId, schoolId, academicSessionId } = ids;

  // 1) Catalogue (idempotent by schoolId+code).
  const idByCode = new Map<string, string>();
  let subjectsCreated = 0;
  for (const s of CATALOGUE) {
    const existing = await prisma.subject.findFirst({ where: { schoolId, code: s.code }, select: { id: true } });
    const id = existing?.id ?? (await prisma.subject.create({
      data: {
        tenantId, schoolId, code: s.code, name: s.name, shortName: s.shortName, department: s.department,
        type: s.type, color: s.color, gradeRangeStart: s.gradeRangeStart, gradeRangeEnd: s.gradeRangeEnd,
        credit: 4, passingMarks: 33, maxMarks: 100, theoryMarks: 100, practicalMarks: 0,
        order: CATALOGUE.indexOf(s),
      },
      select: { id: true },
    })).id;
    if (!existing) subjectsCreated++;
    idByCode.set(s.code, id);
  }

  // 2) Assign subjects to each real class (idempotent by classId+subjectId).
  const classes = await prisma.class.findMany({ where: { schoolId, academicSessionId }, select: { id: true, name: true } });
  let assignmentsCreated = 0;
  for (const cls of classes) {
    const grade = classGrade(cls.name);
    const codes = [...CORE_CODES, ...(grade >= 6 ? ["CS"] : [])];
    for (let i = 0; i < codes.length; i++) {
      const subjectId = idByCode.get(codes[i]);
      if (!subjectId) continue;
      const existing = await prisma.classSubject.findUnique({ where: { classId_subjectId: { classId: cls.id, subjectId } }, select: { id: true } });
      if (existing) continue;
      await prisma.classSubject.create({
        data: { tenantId, schoolId, academicSessionId, classId: cls.id, subjectId, order: i, isCore: CORE_CODES.includes(codes[i]) },
      });
      assignmentsCreated++;
    }
  }

  console.log(`  P6:       ${subjectsCreated} subjects created (${CATALOGUE.length} total), ${assignmentsCreated} class-subject assignments`);
}
