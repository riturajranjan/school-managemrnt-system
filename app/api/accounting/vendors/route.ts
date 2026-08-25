// GET  /api/accounting/vendors — list/filter the school's vendor master. accounting.view.
// POST /api/accounting/vendors — create a vendor. accounting.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { createVendor, listVendors } from "@/lib/server/accounting/vendors";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("accounting.view");
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    const page = singleParam(sp, "page"), pageSize = singleParam(sp, "pageSize");
    const { data, meta } = await listVendors(scope, {
      status: singleParam(sp, "status"), search: singleParam(sp, "search"),
      page: page ? Number(page) : undefined, pageSize: pageSize ? Number(pageSize) : undefined,
    });
    return ok(data, meta);
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("accounting.manage");
    const scope = await requireOrgScope(ctx);
    const data = await createVendor(scope, await readJson(request));
    return ok(data);
  });
}
