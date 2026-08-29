// GET /api/library/copies?status=&bookId=&search= — all copies, real. library.view.
// search matches accession number / barcode / shelf location / book title —
// added for the real Barcode and Shelves views (Phase A production migration).
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { listCopies } from "@/lib/server/library/copies";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("library.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "library");
    const sp = request.nextUrl.searchParams;
    return ok(await listCopies(scope, { bookId: singleParam(sp, "bookId"), status: singleParam(sp, "status"), search: singleParam(sp, "search") }));
  });
}
