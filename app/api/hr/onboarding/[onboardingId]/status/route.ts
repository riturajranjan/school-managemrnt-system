// POST /api/hr/onboarding/[onboardingId]/status { status }
// Manual HR override — task completion also auto-advances status (see
// lib/server/hr/onboarding.ts). hr.manage.
import type { NextRequest } from "next/server";
import { handle, HttpError, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { EMPLOYEE_ONBOARDING_STATUS_VALUES, setEmployeeOnboardingStatus } from "@/lib/server/hr/onboarding";
import type { EmployeeOnboardingStatusDto } from "@/lib/api/contracts";

export async function POST(request: NextRequest, { params }: { params: Promise<{ onboardingId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hr.manage");
    const scope = await requireOrgScope(ctx);
    const { onboardingId } = await params;
    const body = (await readJson(request)) as { status?: unknown };
    if (typeof body.status !== "string" || !(EMPLOYEE_ONBOARDING_STATUS_VALUES as readonly string[]).includes(body.status)) {
      throw new HttpError("VALIDATION_ERROR", "Invalid status");
    }
    return ok(await setEmployeeOnboardingStatus(scope, onboardingId, body.status as EmployeeOnboardingStatusDto));
  });
}
