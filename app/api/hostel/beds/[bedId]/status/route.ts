// POST /api/hostel/beds/[bedId]/status { status: "active"|"maintenance"|"archived" }
// Rejects if the bed has an active resident. hostel.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { setBedStatus } from "@/lib/server/hostel/rooms";

export async function POST(request: NextRequest, { params }: { params: Promise<{ bedId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hostel.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "hostel");
    const { bedId } = await params;
    return ok(await setBedStatus(scope, bedId, await readJson(request)));
  });
}
