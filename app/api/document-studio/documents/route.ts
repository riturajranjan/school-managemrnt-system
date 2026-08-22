// GET /api/document-studio/documents — filters: docType, studentId, staffId,
// status, q. documents.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { listGeneratedDocuments } from "@/lib/server/document-studio/documents";
import type { DocTypeDto } from "@/lib/api/contracts";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("documents.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "documents");
    const sp = request.nextUrl.searchParams;
    return ok(await listGeneratedDocuments(scope, {
      docType: singleParam(sp, "docType") as DocTypeDto | undefined,
      studentId: singleParam(sp, "studentId"), staffId: singleParam(sp, "staffId"),
      status: singleParam(sp, "status"), q: singleParam(sp, "q"),
    }));
  });
}
