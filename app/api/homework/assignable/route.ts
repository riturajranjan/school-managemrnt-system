// GET /api/homework/assignable — the actor's own real (Section, Subject)
// TeachingAssignments — powers the Create Homework form's pickers. Empty for
// anyone without a real, active teaching Staff profile. homework.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { listAssignableTeaching } from "@/lib/server/homework/service";

export async function GET(_request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("homework.manage");
    const scope = await requireOrgScope(ctx);
    return ok(await listAssignableTeaching(scope));
  });
}
