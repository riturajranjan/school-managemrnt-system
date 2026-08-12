// POST /api/super-admin/schools/[schoolId]/marketplace/[appId]/disable — disable
// a school's installation (status DISABLED). platform.marketplace.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { disableInstall } from "@/lib/server/platform/marketplace-service";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ schoolId: string; appId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("platform.marketplace.manage");
    const { schoolId, appId } = await params;
    return ok(await disableInstall({ id: ctx.user.id, name: ctx.user.name ?? null }, schoolId, appId));
  });
}
