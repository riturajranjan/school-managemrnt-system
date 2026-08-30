// GET/PATCH /api/users/[userId] — View Profile / Edit Account. Same
// authorization boundary as the rest of the account-management surface:
// users.manage + tenant scoping + TEACHER teaching-scope restriction. Never
// returns passwordHash or any token. PATCH delegates to the real
// updateStaff/updateStudent/updateGuardian services for a narrow, real field
// subset — see lib/server/users/account-detail.ts for what is and isn't
// editable and why.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getAccountDetail, updateAccountDetail } from "@/lib/server/users/account-detail";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("users.manage");
    const scope = await requireOrgScope(ctx);
    const { userId } = await params;
    return ok(await getAccountDetail(ctx, scope, userId));
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("users.manage");
    const scope = await requireOrgScope(ctx);
    const { userId } = await params;
    return ok(await updateAccountDetail(ctx, scope, userId, await readJson(request)));
  });
}
