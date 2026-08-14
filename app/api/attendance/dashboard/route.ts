// GET /api/attendance/dashboard — real current-day attendance summary tiles +
// eligible/marked/pending section counts + the effective (read-only) attendance
// policy. Read-only reporting surface: attendance.view + attendance feature.
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getDashboard } from "@/lib/server/attendance/reports";

export async function GET() {
  return handle(async () => {
    const ctx = await requirePermission("attendance.view");
    const scope = await requireOrgScope(ctx);
    return ok(await getDashboard(scope));
  });
}
