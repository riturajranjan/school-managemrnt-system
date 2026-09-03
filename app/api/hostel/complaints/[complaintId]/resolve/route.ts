// POST /api/hostel/complaints/:complaintId/resolve — hostel.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { resolveHostelComplaint } from "@/lib/server/hostel/complaints";

export async function POST(request: NextRequest, { params }: { params: Promise<{ complaintId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hostel.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "hostel");
    const { complaintId } = await params;
    return ok(await resolveHostelComplaint(scope, complaintId, await readJson(request)));
  });
}
