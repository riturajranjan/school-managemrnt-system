import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { activateTemplate } from "@/lib/server/document-studio/templates";

export async function POST(_request: Request, { params }: { params: Promise<{ templateId: string }> }) {
  return handle(async () => {
    const { templateId } = await params;
    const ctx = await requirePermission("documents.manageTemplates");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "documents");
    return ok(await activateTemplate(scope, templateId));
  });
}
