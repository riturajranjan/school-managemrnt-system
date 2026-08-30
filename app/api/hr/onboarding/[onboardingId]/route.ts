// GET   /api/hr/onboarding/[onboardingId] — hr.view or hr.manage.
// PATCH /api/hr/onboarding/[onboardingId] — hr.manage.
import type { NextRequest } from "next/server";
import { handle, requireAnyPermission, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getEmployeeOnboarding, updateEmployeeOnboarding } from "@/lib/server/hr/onboarding";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ onboardingId: string }> }) {
  return handle(async () => {
    const ctx = await requireAnyPermission(["hr.view", "hr.manage"]);
    const scope = await requireOrgScope(ctx);
    const { onboardingId } = await params;
    return ok(await getEmployeeOnboarding(scope, onboardingId));
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ onboardingId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hr.manage");
    const scope = await requireOrgScope(ctx);
    const { onboardingId } = await params;
    return ok(await updateEmployeeOnboarding(scope, onboardingId, await readJson(request)));
  });
}
