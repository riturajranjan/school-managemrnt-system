// POST /api/document-studio/preview — resolves + renders WITHOUT allocating a
// document number or persisting anything. documents.generate.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { previewDocument } from "@/lib/server/document-studio/generate";

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("documents.generate");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "documents");
    return ok(await previewDocument(scope, await readJson(request)));
  });
}
