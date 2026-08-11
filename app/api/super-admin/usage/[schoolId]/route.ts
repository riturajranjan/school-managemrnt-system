// GET /api/super-admin/usage/[schoolId] — one school's usage vs plan limits.
// Read-only; platform.usage.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { fail, ok } from "@/lib/server/api/response";
import { getSchoolUsage } from "@/lib/server/platform/usage-service";

type Ctx = { params: Promise<{ schoolId: string }> };

export async function GET(_request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    await requirePermission("platform.usage.view");
    const { schoolId } = await params;
    const usage = await getSchoolUsage(schoolId);
    if (!usage) return fail("INVALID_SCHOOL", "School not found");
    return ok(usage);
  });
}
