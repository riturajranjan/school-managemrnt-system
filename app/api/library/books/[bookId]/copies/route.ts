// GET  /api/library/books/[bookId]/copies — library.view.
// POST /api/library/books/[bookId]/copies — create a copy. Accession number
//      server-generated, race-safe. library.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { createCopy, listCopies } from "@/lib/server/library/copies";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ bookId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("library.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "library");
    const { bookId } = await params;
    return ok(await listCopies(scope, { bookId }));
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ bookId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("library.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "library");
    const { bookId } = await params;
    return ok(await createCopy(scope, bookId, await readJson(request)));
  });
}
