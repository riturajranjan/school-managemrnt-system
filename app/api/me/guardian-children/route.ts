// GET /api/me/guardian-children — the caller's own real linked children, via
// real StudentGuardian rows (Phase 9W.2 account foundation). Identity-scoped:
// a GUARDIAN account holds zero domain permissions by design. 404 if this
// User has no linked Guardian.
import { handle, requireAuth } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { assertLinked, getMyGuardianChildren } from "@/lib/server/identity/self-profile";

export async function GET() {
  return handle(async () => {
    const ctx = await requireAuth();
    return ok(assertLinked(await getMyGuardianChildren(ctx.user.id), "No guardian account is linked to this login"));
  });
}
