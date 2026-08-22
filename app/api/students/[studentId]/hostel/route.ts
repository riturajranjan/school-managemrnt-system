// GET /api/students/[studentId]/hostel — Student 360 Hostel tab: real
// current assignment + history. students.view — matches the rest of the
// Student 360 profile (see the Library/Transport tabs' identical precedent).
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { getStudentHostelProfile } from "@/lib/server/hostel/student-profile";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("students.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "hostel");
    const { studentId } = await params;
    return ok(await getStudentHostelProfile(scope, studentId));
  });
}
