// DELETE /api/me/sessions/[sessionId] — sign out one of the caller's OWN
// other devices. Identity-scoped (requireAuth only) — ownership is enforced
// in revokeMySession (userId match), never trusting the id alone.
import { handle, requireAuth } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { revokeMySession } from "@/lib/server/auth/account";

export async function DELETE(_request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  return handle(async () => {
    const ctx = await requireAuth();
    const { sessionId } = await params;
    await revokeMySession(ctx.user.id, sessionId);
    return ok({ revoked: true });
  });
}
