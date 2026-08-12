// GET /api/students/[studentId]/attendance — a student's real attendance summary
// + recent records (Student 360 tab). Scoped to the caller's school + session.
// attendance.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { studentAttendance } from "@/lib/server/attendance/service";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("attendance.view");
    const scope = await requireOrgScope(ctx);
    const { studentId } = await params;
    return ok(await studentAttendance(scope, studentId));
  });
}
