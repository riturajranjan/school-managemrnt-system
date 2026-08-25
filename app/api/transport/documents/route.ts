// GET  /api/transport/documents — real compliance documents + summary in one
// response. Metadata-only — no file upload/storage. transport.view.
// POST /api/transport/documents — add a document record. transport.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { addDocument, getComplianceSummary, listDocuments } from "@/lib/server/transport/documents";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("transport.view");
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    const [documents, compliance] = await Promise.all([listDocuments(scope, { subjectType: singleParam(sp, "subjectType") }), getComplianceSummary(scope)]);
    return ok({ documents, compliance });
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("transport.manage");
    const scope = await requireOrgScope(ctx);
    const body = await readJson(request);
    return ok(await addDocument(scope, body));
  });
}
