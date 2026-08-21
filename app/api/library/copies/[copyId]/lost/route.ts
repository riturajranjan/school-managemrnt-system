// POST /api/library/copies/[copyId]/lost — mark a copy lost, closing any
// active loan on it as LOST. library.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { markCopyLost } from "@/lib/server/library/loans";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ copyId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("library.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "library");
    const { copyId } = await params;
    return ok(await markCopyLost(scope, copyId));
  });
}
