// POST /api/hostel/assignments/[assignmentId]/transfer — atomic close-old +
// create-new; insufficient/occupied target bed rolls back the whole
// transaction (no half-transfer). hostel.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { transferAssignment } from "@/lib/server/hostel/assignments";

export async function POST(request: NextRequest, { params }: { params: Promise<{ assignmentId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hostel.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "hostel");
    const { assignmentId } = await params;
    return ok(await transferAssignment(scope, assignmentId, await readJson(request)));
  });
}
