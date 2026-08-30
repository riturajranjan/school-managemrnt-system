// GET   /api/hr/job-applicants/[applicantId] — hr.view or hr.manage.
// PATCH /api/hr/job-applicants/[applicantId] — hr.manage.
import type { NextRequest } from "next/server";
import { handle, requireAnyPermission, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getJobApplicant, updateJobApplicant } from "@/lib/server/hr/recruitment";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ applicantId: string }> }) {
  return handle(async () => {
    const ctx = await requireAnyPermission(["hr.view", "hr.manage"]);
    const scope = await requireOrgScope(ctx);
    const { applicantId } = await params;
    return ok(await getJobApplicant(scope, applicantId));
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ applicantId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hr.manage");
    const scope = await requireOrgScope(ctx);
    const { applicantId } = await params;
    return ok(await updateJobApplicant(scope, applicantId, await readJson(request)));
  });
}
