// POST /api/hr/job-applicants/[applicantId]/start-onboarding
// { employeeCode, startDate, expectedCompletionDate?, hrOwnerStaffId? }
// Explicit conversion action — never automatic. Only a SELECTED applicant
// may be converted; reuses the existing Staff provisioning service
// (lib/server/staff/service.ts createStaff), never a second employee-
// creation system. hr.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { startOnboardingFromApplicant } from "@/lib/server/hr/recruitment";

export async function POST(request: NextRequest, { params }: { params: Promise<{ applicantId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hr.manage");
    const scope = await requireOrgScope(ctx);
    const { applicantId } = await params;
    return ok(await startOnboardingFromApplicant(scope, applicantId, await readJson(request)));
  });
}
