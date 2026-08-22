// GET /api/document-studio/documents/[documentId] — documents.view.
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { getGeneratedDocument } from "@/lib/server/document-studio/documents";

export async function GET(_request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  return handle(async () => {
    const { documentId } = await params;
    const ctx = await requirePermission("documents.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "documents");
    return ok(await getGeneratedDocument(scope, documentId));
  });
}
