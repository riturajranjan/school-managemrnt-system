// GET   /api/hr/job-openings/[openingId] — hr.view or hr.manage.
// PATCH /api/hr/job-openings/[openingId] — hr.manage.
import type { NextRequest } from "next/server";
import { handle, requireAnyPermission, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getJobOpening, updateJobOpening } from "@/lib/server/hr/recruitment";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ openingId: string }> }) {
  return handle(async () => {
    const ctx = await requireAnyPermission(["hr.view", "hr.manage"]);
    const scope = await requireOrgScope(ctx);
    const { openingId } = await params;
    return ok(await getJobOpening(scope, openingId));
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ openingId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hr.manage");
    const scope = await requireOrgScope(ctx);
    const { openingId } = await params;
    return ok(await updateJobOpening(scope, openingId, await readJson(request)));
  });
}
