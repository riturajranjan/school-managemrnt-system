// GET /api/users — list real accounts (User + roles + domain link) within the
// caller's own tenant. users.manage required. Read-only oversight; actual
// account creation/role changes go through /api/users/provision and
// /api/users/[userId]/roles, both policy-gated separately.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { parsePagination, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { listAccounts } from "@/lib/server/users/provisioning";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("users.manage");
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    const { page, pageSize } = parsePagination(sp);
    const { data, meta } = await listAccounts(scope, { page, pageSize, search: singleParam(sp, "search") });
    return ok(data, meta);
  });
}
