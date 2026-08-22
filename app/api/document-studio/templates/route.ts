// GET  /api/document-studio/templates — filters: docType, status, kind. documents.view.
// POST /api/document-studio/templates — create a DRAFT template. documents.manageTemplates.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { createTemplate, listTemplates } from "@/lib/server/document-studio/templates";
import type { DocTypeDto } from "@/lib/api/contracts";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("documents.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "documents");
    const sp = request.nextUrl.searchParams;
    return ok(await listTemplates(scope, { docType: singleParam(sp, "docType") as DocTypeDto | undefined, status: singleParam(sp, "status"), kind: singleParam(sp, "kind") }));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("documents.manageTemplates");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "documents");
    return ok(await createTemplate(scope, await readJson(request)));
  });
}
