// POST /api/inventory/issues/[issueId]/return — receive returnable issued
// stock; a "good" return re-enters the ledger, "damaged" closes the
// outstanding balance without restocking. inventory.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { returnIssue } from "@/lib/server/inventory/issues";

export async function POST(request: NextRequest, { params }: { params: Promise<{ issueId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("inventory.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "inventory");
    const { issueId } = await params;
    return ok(await returnIssue(scope, issueId, await readJson(request)));
  });
}
