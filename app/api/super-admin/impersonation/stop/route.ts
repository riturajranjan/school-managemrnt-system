// POST /api/super-admin/impersonation/stop — end the current impersonation.
//
// Server clears the DB context (never a client-only reset). Idempotent: if
// nothing is active it simply reports { active: false }. Only the true platform
// actor's own session can stop its own impersonation (bound to ctx.sessionId).
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { stopImpersonation } from "@/lib/server/platform/impersonation-service";

export async function POST() {
  return handle(async () => {
    const ctx = await requirePermission("platform.impersonation.manage");
    const state = await stopImpersonation({
      sessionId: ctx.sessionId,
      actor: { id: ctx.user.id, name: ctx.user.name ?? null },
    });
    return ok(state);
  });
}
