// GET /api/students/[studentId]/library — Student 360 Library tab: real
// active loans + recent return history. students.view — matches the rest of
// the Student 360 profile (see the Transport tab's identical precedent).
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { getStudentLibraryProfile } from "@/lib/server/library/loans";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("students.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "library");
    const { studentId } = await params;
    return ok(await getStudentLibraryProfile(scope, studentId));
  });
}
