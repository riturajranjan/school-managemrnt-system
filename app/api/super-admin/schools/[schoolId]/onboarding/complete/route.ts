// POST /api/super-admin/schools/[schoolId]/onboarding/complete — verify all
// required steps, then atomically mark onboarding COMPLETED and the school ACTIVE.
// platform.onboarding.manage. Returns ONBOARDING_INCOMPLETE (409) if steps remain.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { completeOnboarding } from "@/lib/server/platform/onboarding-service";

type Ctx = { params: Promise<{ schoolId: string }> };

export async function POST(_request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const ctx = await requirePermission("platform.onboarding.manage");
    const { schoolId } = await params;
    return ok(await completeOnboarding({ id: ctx.user.id, name: ctx.user.name ?? null }, schoolId));
  });
}
