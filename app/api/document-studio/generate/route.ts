// POST /api/document-studio/generate — real, server-authoritative issuance.
// documents.generate.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { generateDocument } from "@/lib/server/document-studio/generate";

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("documents.generate");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "documents");
    return ok(await generateDocument(scope, await readJson(request)));
  });
}
