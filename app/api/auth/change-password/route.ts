// POST /api/auth/change-password — self-service password change. Always
// requires the caller's real current password. Works even before a school/
// role has been selected (the forced first-login flow can reach this before
// org context resolves), so it deliberately only requires a valid session,
// not users.manage or an OrgScope. On success, re-runs the same post-login
// resolution normal login uses so the client can continue exactly where
// login would have sent it.
import type { NextRequest } from "next/server";
import { handle, requireAuth } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { changeOwnPassword } from "@/lib/server/auth/password-change";
import { resolvePostLogin } from "@/lib/server/context/resolver";

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requireAuth();
    await changeOwnPassword(ctx, await readJson(request));
    const redirectTo = await resolvePostLogin(ctx.user.id);
    return ok({ redirectTo });
  });
}
