// POST /api/users/[userId]/password — administrator password reset. Sets a
// real password directly; never generates or sends a setup/reset link (that
// is what /api/users/[userId]/reset-password is for — a separate, still-real
// capability this route does not replace). Same users.manage + tenant +
// TEACHER-teaching-scope authorization boundary as every other
// account-management action; blocked entirely for the actor's own account
// (see lib/server/auth/password-change.ts).
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { adminSetPassword } from "@/lib/server/auth/password-change";

export async function POST(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("users.manage");
    const scope = await requireOrgScope(ctx);
    const { userId } = await params;
    await adminSetPassword(ctx, scope, userId, await readJson(request));
    return ok({ success: true });
  });
}
