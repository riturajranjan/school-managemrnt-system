// GET   /api/admissions/[applicationId] — full application (history, notes, docs).
// PATCH /api/admissions/[applicationId] — edit application fields (not stage).
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { requireOrgScope } from "@/lib/server/api/scope";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { getApplicationDetail, updateApplication } from "@/lib/server/admissions/service";

type Ctx = { params: Promise<{ applicationId: string }> };

export async function GET(_request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const ctx = await requirePermission("admissions.view");
    const scope = await requireOrgScope(ctx);
    const { applicationId } = await params;
    return ok(await getApplicationDetail(scope, applicationId));
  });
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const ctx = await requirePermission("admissions.update");
    const scope = await requireOrgScope(ctx);
    const { applicationId } = await params;
    const body = await readJson(request);
    return ok(await updateApplication(scope, applicationId, body));
  });
}
