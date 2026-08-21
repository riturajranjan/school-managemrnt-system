// GET /api/students/[studentId]/transport — Student 360 Transport tab: the
// student's current real transport assignment (never a live location).
// students.view — matches the rest of the Student 360 profile.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getStudentTransportProfile } from "@/lib/server/transport/student-assignments";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("students.view");
    const scope = await requireOrgScope(ctx);
    const { studentId } = await params;
    return ok(await getStudentTransportProfile(scope, studentId));
  });
}
