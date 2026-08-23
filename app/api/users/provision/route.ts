// POST /api/users/provision — the ONE real entry point for hierarchical
// account provisioning. users.manage required; the actual target-role
// legality check happens server-side in provisionAccount() against
// ROLE_CREATION_POLICY using the caller's real active role — a client-
// submitted targetRoleKey is never trusted on its own.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { provisionAccount } from "@/lib/server/users/provisioning";

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("users.manage");
    const scope = await requireOrgScope(ctx);
    return ok(await provisionAccount(ctx, scope, await readJson(request)));
  });
}
