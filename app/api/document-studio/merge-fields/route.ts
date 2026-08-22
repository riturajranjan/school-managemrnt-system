// GET /api/document-studio/merge-fields?subjectType=student|staff — the
// allowlisted set of merge fields a template author can pick from.
// documents.manageTemplates (only template authors need this list).
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { HttpError } from "@/lib/server/api/guard";
import { singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { mergeFieldsFor } from "@/lib/server/document-studio/merge-fields";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("documents.manageTemplates");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "documents");
    const subjectType = singleParam(request.nextUrl.searchParams, "subjectType");
    if (subjectType !== "student" && subjectType !== "staff") throw new HttpError("VALIDATION_ERROR", "subjectType must be student or staff");
    return ok(mergeFieldsFor(subjectType === "student" ? "STUDENT" : "STAFF"));
  });
}
