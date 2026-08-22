// Student Achievements (Phase 9U) — factual, manually-entered records only.
// Never a score, rank, or auto-generated award.
import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { StudentAchievementDto } from "@/lib/api/contracts";
import { requireValidStudent } from "./access";

function dto(a: { id: string; studentId: string; activityId: string | null; title: string; description: string | null; awardedAt: Date; createdAt: Date; activity: { name: string } | null }): StudentAchievementDto {
  return {
    id: a.id, studentId: a.studentId, activityId: a.activityId, activityName: a.activity?.name ?? null,
    title: a.title, description: a.description, awardedAt: a.awardedAt.toISOString().slice(0, 10), createdAt: a.createdAt.toISOString(),
  };
}

export async function listAchievements(scope: OrgScope, params: { studentId?: string } = {}): Promise<StudentAchievementDto[]> {
  const rows = await prisma.studentAchievement.findMany({
    where: { schoolId: scope.schoolId, ...(params.studentId ? { studentId: params.studentId } : {}) },
    select: { id: true, studentId: true, activityId: true, title: true, description: true, awardedAt: true, createdAt: true, activity: { select: { name: true } } },
    orderBy: { awardedAt: "desc" },
  });
  return rows.map(dto);
}

export const createAchievementSchema = z.object({
  studentId: z.string().min(1),
  activityId: z.string().min(1).optional(),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(500).optional(),
  awardedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function createAchievement(scope: OrgScope, raw: unknown): Promise<StudentAchievementDto> {
  const input = parseInput(createAchievementSchema, raw);
  await requireValidStudent(scope, input.studentId);

  const row = await prisma.studentAchievement.create({
    data: {
      tenantId: scope.tenantId, schoolId: scope.schoolId, studentId: input.studentId, activityId: input.activityId,
      title: input.title, description: input.description, awardedAt: new Date(`${input.awardedAt}T00:00:00.000Z`), createdByUserId: scope.actor.id,
    },
    select: { id: true, studentId: true, activityId: true, title: true, description: true, awardedAt: true, createdAt: true, activity: { select: { name: true } } },
  });
  await recordAudit(prisma, scope, "ACTIVITY_ACHIEVEMENT_RECORDED", "StudentAchievement", row.id, { studentId: input.studentId });
  return dto(row);
}
