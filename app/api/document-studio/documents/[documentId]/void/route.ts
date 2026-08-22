// POST /api/document-studio/documents/[documentId]/void — documents.void.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { voidDocument } from "@/lib/server/document-studio/documents";

export async function POST(request: NextRequest, { params }: { params: Promise<{ documentId: string }> }) {
  return handle(async () => {
    const { documentId } = await params;
    const ctx = await requirePermission("documents.void");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "documents");
    return ok(await voidDocument(scope, documentId, await readJson(request)));
  });
}
