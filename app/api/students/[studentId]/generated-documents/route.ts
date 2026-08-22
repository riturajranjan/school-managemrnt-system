// GET /api/students/[studentId]/generated-documents — Student 360 tab. Uses
// students.view (matches Library/Transport/Cafeteria/Activities precedent) —
// a generated certificate/ID card is not confidential health/counseling-tier
// data. Clearly a different concept from the existing uploaded
// StudentDocument compliance tab.
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { getStudentGeneratedDocuments } from "@/lib/server/document-studio/subject-profile";

export async function GET(_request: Request, { params }: { params: Promise<{ studentId: string }> }) {
  return handle(async () => {
    const { studentId } = await params;
    const ctx = await requirePermission("students.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "documents");
    return ok(await getStudentGeneratedDocuments(scope, studentId));
  });
}
