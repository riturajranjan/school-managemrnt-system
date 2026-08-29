// GET /api/hr/self-service — the caller's OWN real HR data (identity-scoped,
// hr.viewOwn — never another employee's, regardless of role).
import { handle, requireAnyPermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getMySelfService } from "@/lib/server/hr/self-service";

export async function GET() {
  return handle(async () => {
    // hr.viewOwn covers every employee-representing role; hr.view/hr.manage
    // (whole-directory access) also implies being able to see one's own record.
    const ctx = await requireAnyPermission(["hr.viewOwn", "hr.view", "hr.manage"]);
    const scope = await requireOrgScope(ctx);
    return ok(await getMySelfService(scope));
  });
}
