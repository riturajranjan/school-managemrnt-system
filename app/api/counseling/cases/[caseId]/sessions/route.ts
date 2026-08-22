// GET  /api/counseling/cases/[caseId]/sessions — session metadata list (no
//      confidential notes). counseling.view.
// POST /api/counseling/cases/[caseId]/sessions — record a session; the
//      counselor is always the caller's own real, active Staff identity.
//      counseling.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { createSession, listSessionsForCase } from "@/lib/server/counseling/sessions";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  return handle(async () => {
    const { caseId } = await params;
    const ctx = await requirePermission("counseling.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "counseling");
    return ok(await listSessionsForCase(scope, caseId));
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  return handle(async () => {
    const { caseId } = await params;
    const ctx = await requirePermission("counseling.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "counseling");
    return ok(await createSession(scope, caseId, await readJson(request)));
  });
}
