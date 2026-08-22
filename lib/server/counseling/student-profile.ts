// Student 360 Counseling tab (Phase 9S) — safe METADATA only (counseling.view).
// Never includes confidential note content — that requires a separate
// dedicated endpoint gated by counseling.viewConfidential AND ownership.
import { prisma } from "@/lib/db/prisma";
import type { OrgScope } from "@/lib/server/api/scope";
import type { StudentCounselingProfileDto } from "@/lib/api/contracts";
import { staffDisplayName } from "./access";

export async function getStudentCounselingProfile(scope: OrgScope, studentId: string): Promise<StudentCounselingProfileDto> {
  const cases = await prisma.counselingCase.findMany({
    where: { studentId, schoolId: scope.schoolId },
    select: {
      id: true, status: true, concernCategory: true, followUpDate: true,
      assignedCounselor: { select: { firstName: true, lastName: true, displayName: true } },
    },
    orderBy: { openedAt: "desc" },
  });

  const active = cases.find((c) => c.status !== "CLOSED") ?? null;

  return {
    hasActiveSupport: active !== null,
    currentCase: active
      ? {
          id: active.id, status: active.status.toLowerCase() as never,
          assignedCounselorName: active.assignedCounselor ? staffDisplayName(active.assignedCounselor) : null,
          concernCategory: active.concernCategory ? (active.concernCategory.toLowerCase() as never) : null,
          followUpDate: active.followUpDate?.toISOString().slice(0, 10) ?? null,
        }
      : null,
    caseCount: cases.length,
  };
}
