// GET /api/students/[studentId]/cafeteria — Student 360 Cafeteria tab.
// Matches the Library/Transport precedent — uses students.view, since meal
// history here carries no confidential content (unlike Health/Counseling).
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { getStudentCafeteriaProfile } from "@/lib/server/cafeteria/student-profile";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  return handle(async () => {
    const { studentId } = await params;
    const ctx = await requirePermission("students.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "cafeteria");
    return ok(await getStudentCafeteriaProfile(scope, studentId));
  });
}
