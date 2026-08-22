import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { getDocumentStudioDashboard } from "@/lib/server/document-studio/dashboard";

export async function GET() {
  return handle(async () => {
    const ctx = await requirePermission("documents.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "documents");
    return ok(await getDocumentStudioDashboard(scope));
  });
}
