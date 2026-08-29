// POST /api/me/password — change the caller's own password. Identity-scoped
// (requireAuth only, no permission key): every authenticated user may change
// their own password regardless of role.
import type { NextRequest } from "next/server";
import { handle, requireAuth } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { changeOwnPassword } from "@/lib/server/auth/account";

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requireAuth();
    await changeOwnPassword(ctx.user.id, await readJson(request));
    return ok({ changed: true });
  });
}
