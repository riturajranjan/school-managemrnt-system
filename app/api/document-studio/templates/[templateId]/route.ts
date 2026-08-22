// GET   /api/document-studio/templates/[templateId] — documents.view.
// PATCH /api/document-studio/templates/[templateId] — documents.manageTemplates.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { getTemplate, updateTemplate } from "@/lib/server/document-studio/templates";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ templateId: string }> }) {
  return handle(async () => {
    const { templateId } = await params;
    const ctx = await requirePermission("documents.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "documents");
    return ok(await getTemplate(scope, templateId));
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ templateId: string }> }) {
  return handle(async () => {
    const { templateId } = await params;
    const ctx = await requirePermission("documents.manageTemplates");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "documents");
    return ok(await updateTemplate(scope, templateId, await readJson(request)));
  });
}
