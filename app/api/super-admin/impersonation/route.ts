// GET /api/super-admin/impersonation — current impersonation state (safe).
//
// Server-authoritative (SA-4K). State lives in the DB bound to the auth session;
// nothing the browser stores can start or fake it. Available to any authenticated
// session (returns { active: false } when nothing is active).
import { handle, requireAuth } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { getActiveImpersonation } from "@/lib/server/platform/impersonation-service";

export async function GET() {
  return handle(async () => {
    const ctx = await requireAuth();
    return ok(await getActiveImpersonation(ctx.sessionId));
  });
}
