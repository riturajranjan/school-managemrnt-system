// GET   /api/accounting/vendors/[vendorId] — vendor detail. accounting.view.
// PATCH /api/accounting/vendors/[vendorId] — edit fields/status. accounting.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getVendor, updateVendor } from "@/lib/server/accounting/vendors";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ vendorId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("accounting.view");
    const scope = await requireOrgScope(ctx);
    const { vendorId } = await params;
    const data = await getVendor(scope, vendorId);
    return ok(data);
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ vendorId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("accounting.manage");
    const scope = await requireOrgScope(ctx);
    const { vendorId } = await params;
    const data = await updateVendor(scope, vendorId, await readJson(request));
    return ok(data);
  });
}
