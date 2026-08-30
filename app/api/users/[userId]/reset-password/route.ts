// POST /api/users/[userId]/reset-password — admin-triggered password reset.
// Reissues a real one-time setup link (reusing the same primitive account
// creation already uses) — never sets or returns a real password. users.manage
// required; a TEACHER caller is further restricted to their own teaching
// scope, same as every other account-management action.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { reissuePasswordSetup } from "@/lib/server/users/provisioning";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("users.manage");
    const scope = await requireOrgScope(ctx);
    const { userId } = await params;
    return ok(await reissuePasswordSetup(ctx, scope, userId));
  });
}
