// GET /api/students/[studentId]/counseling — Student 360 Counseling tab.
// Like Health, general Student 360 access (students.view) must NOT
// automatically grant counseling access — this route requires
// counseling.view specifically. Safe metadata only, never confidential notes.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { getStudentCounselingProfile } from "@/lib/server/counseling/student-profile";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  return handle(async () => {
    const { studentId } = await params;
    const ctx = await requirePermission("counseling.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "counseling");
    return ok(await getStudentCounselingProfile(scope, studentId));
  });
}
