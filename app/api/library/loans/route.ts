// GET  /api/library/loans — real circulation history. library.view.
// POST /api/library/loans — issue a book. Server-authoritative, concurrency-
//      safe (dual guard: conditional copy-status update + partial unique
//      index). library.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { issueLoan, listLoans } from "@/lib/server/library/loans";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("library.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "library");
    const sp = request.nextUrl.searchParams;
    return ok(await listLoans(scope, { status: singleParam(sp, "status"), studentId: singleParam(sp, "studentId"), staffId: singleParam(sp, "staffId"), copyId: singleParam(sp, "copyId") }));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("library.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "library");
    return ok(await issueLoan(scope, await readJson(request)));
  });
}
