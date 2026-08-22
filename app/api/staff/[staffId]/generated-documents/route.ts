// GET /api/staff/[staffId]/generated-documents — Staff 360 tab. Uses hr.view
// (matches the real Staff API's own permission).
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { getStaffGeneratedDocuments } from "@/lib/server/document-studio/subject-profile";

export async function GET(_request: Request, { params }: { params: Promise<{ staffId: string }> }) {
  return handle(async () => {
    const { staffId } = await params;
    const ctx = await requirePermission("hr.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "documents");
    return ok(await getStaffGeneratedDocuments(scope, staffId));
  });
}
