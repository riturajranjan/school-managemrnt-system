// GET /api/me/sessions — the caller's own active (unexpired) sessions.
// Identity-scoped (requireAuth only).
import { handle, requireAuth } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { listMySessions } from "@/lib/server/auth/account";

export async function GET() {
  return handle(async () => {
    const ctx = await requireAuth();
    return ok(await listMySessions(ctx.user.id, ctx.sessionId));
  });
}
