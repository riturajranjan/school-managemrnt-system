// GET /api/teaching-assignments/mine — the authenticated actor's own real
// TeachingAssignments (real Section + Subject), resolved via User ->
// Staff.userId server-side. Never the fake CURRENT_TEACHER_ID. academics.view
// — the same gate as the teacher-options resolver (/api/staff/teachers), so
// a teacher can see their own assignments without HR-manage rights.
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getCurrentStaffProfile } from "@/lib/server/staff/service";
import { listTeachingAssignmentsForStaff } from "@/lib/server/academics/teaching-assignments-service";

export async function GET() {
  return handle(async () => {
    const ctx = await requirePermission("academics.view");
    const scope = await requireOrgScope(ctx);
    const staff = await getCurrentStaffProfile(scope);
    if (!staff) return ok([]);
    return ok(await listTeachingAssignmentsForStaff(scope, staff.id));
  });
}
