// GET /api/staff/[staffId]/teacher-detail — Teacher/Staff detail aggregation
// (Phase 9J): real Staff profile + TeachingAssignments + timetable/homework/
// lesson-plans/attendance/leave, each included only when the caller's OWN
// permissions cover that domain (never partially fabricated, never gated
// solely by hr.view). hr.view — same base gate as the Staff/Teacher directory.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getStaffTeacherDetail } from "@/lib/server/staff/teacher-detail-service";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ staffId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hr.view");
    const scope = await requireOrgScope(ctx);
    const { staffId } = await params;
    const detail = await getStaffTeacherDetail(scope, staffId, {
      timetable: ctx.permissions.has("timetable.view"),
      homework: ctx.permissions.has("homework.view"),
      lessonPlans: ctx.permissions.has("lessonPlans.view"),
      leaveManage: ctx.permissions.has("leave.approve"),
      payroll: ctx.permissions.has("payroll.view"),
    });
    return ok(detail);
  });
}
