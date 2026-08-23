// POST /api/users/[userId]/roles — grant an existing account an additional
// role, subject to the SAME ROLE_CREATION_POLICY as fresh provisioning
// (never a role above/beside what the caller is authorized to grant).
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { assignRoleToAccount } from "@/lib/server/users/provisioning";

export async function POST(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("users.manage");
    const scope = await requireOrgScope(ctx);
    const { userId } = await params;
    await assignRoleToAccount(ctx, scope, userId, await readJson(request));
    return ok({ success: true });
  });
}
