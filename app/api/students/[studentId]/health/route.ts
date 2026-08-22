// GET /api/students/[studentId]/health — Student 360 Health tab. Unlike the
// Library/Transport/Hostel tabs (which use students.view, matching the rest
// of the Student 360 profile), Health data is more sensitive: general
// Student 360 access must NOT automatically grant health-data access, so
// this route requires health.view specifically, not students.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { getStudentHealthProfile } from "@/lib/server/health/student-profile";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  return handle(async () => {
    const { studentId } = await params;
    const ctx = await requirePermission("health.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "health");
    const sensitive = ctx.permissions.has("health.viewSensitive");
    return ok(await getStudentHealthProfile(scope, studentId, sensitive));
  });
}
