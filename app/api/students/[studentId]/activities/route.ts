// GET /api/students/[studentId]/activities — Student 360 Activities tab.
// Matches the Library/Transport/Cafeteria precedent — students.view, since
// activity membership/participation carries no confidential content.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { getStudentActivityProfile } from "@/lib/server/activities/student-profile";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  return handle(async () => {
    const { studentId } = await params;
    const ctx = await requirePermission("students.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "activities");
    return ok(await getStudentActivityProfile(scope, studentId));
  });
}
