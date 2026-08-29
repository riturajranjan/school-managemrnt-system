// DELETE /api/library/digital-resources/[resourceId] — remove a resource
// record (never affects a real file, since none is stored). library.manage.
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { deleteDigitalResource } from "@/lib/server/library/digital-resources";

export async function DELETE(_request: Request, { params }: { params: Promise<{ resourceId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("library.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "library");
    const { resourceId } = await params;
    await deleteDigitalResource(scope, resourceId);
    return ok({ deleted: true });
  });
}
