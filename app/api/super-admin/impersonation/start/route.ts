// POST /api/super-admin/impersonation/start — start read-only school inspection.
//
// Requires the high-trust platform.impersonation.manage permission (SUPER_ADMIN
// only). The body carries ONLY a schoolId; the target tenant is derived from the
// school server-side. Never accepts tenantId/roleId/permissionIds/branchId.
import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { parseInput } from "@/lib/server/validation";
import { startImpersonation } from "@/lib/server/platform/impersonation-service";

const startSchema = z.object({ schoolId: z.string().min(1) });

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("platform.impersonation.manage");
    const { schoolId } = parseInput(startSchema, await readJson(request));
    const state = await startImpersonation({
      sessionId: ctx.sessionId,
      actor: { id: ctx.user.id, name: ctx.user.name ?? null },
      schoolId,
    });
    return ok(state);
  });
}
