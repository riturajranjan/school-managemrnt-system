// GET /api/me/student-profile — the caller's own real Student identity
// (Phase 9W.2 account foundation). Identity-scoped, not permission-scoped: a
// STUDENT account holds zero domain permissions by design. 404 if this User
// has no linked Student.
import { handle, requireAuth } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { assertLinked, getMyStudentProfile } from "@/lib/server/identity/self-profile";

export async function GET() {
  return handle(async () => {
    const ctx = await requireAuth();
    return ok(assertLinked(await getMyStudentProfile(ctx.user.id), "No student account is linked to this login"));
  });
}
