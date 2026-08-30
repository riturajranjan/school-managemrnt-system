// POST /api/hr/onboarding-tasks/[taskId]/complete — hr.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { completeOnboardingTask } from "@/lib/server/hr/onboarding";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hr.manage");
    const scope = await requireOrgScope(ctx);
    const { taskId } = await params;
    return ok(await completeOnboardingTask(scope, taskId));
  });
}
