// Student 360 Cafeteria tab (Phase 9T) — recent real meal history only.
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";
import type { StudentCafeteriaProfileDto } from "@/lib/api/contracts";
import { listMeals } from "./meals";

export async function getStudentCafeteriaProfile(scope: OrgScope, studentId: string): Promise<StudentCafeteriaProfileDto> {
  const student = await prisma.student.findFirst({ where: { id: studentId, schoolId: scope.schoolId }, select: { id: true } });
  if (!student) throw new HttpError("NOT_FOUND", "Student not found");
  const { items } = await listMeals(scope, { studentId, pageSize: 15 });
  return { recentMeals: items };
}
