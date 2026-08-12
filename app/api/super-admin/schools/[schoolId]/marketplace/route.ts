// GET /api/super-admin/schools/[schoolId]/marketplace — a school's installations.
// platform.marketplace.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { listSchoolInstalls } from "@/lib/server/platform/marketplace-service";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ schoolId: string }> }) {
  return handle(async () => {
    await requirePermission("platform.marketplace.view");
    const { schoolId } = await params;
    return ok(await listSchoolInstalls(schoolId));
  });
}
