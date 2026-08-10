// GET  /api/guardians — paginated, searchable guardian directory with linked children.
// POST /api/guardians — create a guardian (tenant-scoped; rejects duplicate email).
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { requireOrgScope } from "@/lib/server/api/scope";
import { parsePagination, readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { createGuardian, listGuardians } from "@/lib/server/guardians/service";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("guardians.view");
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    const { page, pageSize } = parsePagination(sp);
    const { data, meta } = await listGuardians(scope, { page, pageSize, search: singleParam(sp, "search") });
    return ok(data, meta);
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("guardians.create");
    const scope = await requireOrgScope(ctx);
    const body = await readJson(request);
    return ok(await createGuardian(scope, body));
  });
}
