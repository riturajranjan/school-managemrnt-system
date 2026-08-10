// GET   /api/super-admin/schools/[schoolId]/onboarding — one school's onboarding.
// PATCH /api/super-admin/schools/[schoolId]/onboarding — update steps/currentStep.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { getOnboarding, updateOnboarding } from "@/lib/server/platform/onboarding-service";

type Ctx = { params: Promise<{ schoolId: string }> };

export async function GET(_request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    await requirePermission("platform.onboarding.view");
    const { schoolId } = await params;
    return ok(await getOnboarding(schoolId));
  });
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const ctx = await requirePermission("platform.onboarding.manage");
    const { schoolId } = await params;
    const body = await readJson(request);
    return ok(await updateOnboarding({ id: ctx.user.id, name: ctx.user.name ?? null }, schoolId, body));
  });
}
