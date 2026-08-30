// GET  /api/hr/documents — hr.view or hr.manage (whole-directory read).
// POST /api/hr/documents — hr.manage. Metadata only — see
// lib/server/hr/documents.ts for the storage-gap note; no binary/object
// storage is integrated in this codebase.
import type { NextRequest } from "next/server";
import { handle, requireAnyPermission, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { listStaffDocuments, uploadStaffDocument } from "@/lib/server/hr/documents";
import type { StaffDocumentStatusDto } from "@/lib/api/contracts";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requireAnyPermission(["hr.view", "hr.manage"]);
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    return ok(
      await listStaffDocuments(scope, {
        staffId: singleParam(sp, "staffId"),
        status: singleParam(sp, "status") as StaffDocumentStatusDto | undefined,
      }),
    );
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("hr.manage");
    const scope = await requireOrgScope(ctx);
    return ok(await uploadStaffDocument(scope, await readJson(request)));
  });
}
