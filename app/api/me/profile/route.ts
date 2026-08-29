// GET /api/me/profile — the caller's own real identity for the avatar
// dropdown and /profile page. Identity-scoped (requireAuth only) — every
// authenticated user can read their own profile regardless of role.
import { handle, requireAuth } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { getMyProfile } from "@/lib/server/identity/self-profile";

export async function GET() {
  return handle(async () => {
    const ctx = await requireAuth();
    return ok(await getMyProfile(ctx));
  });
}
