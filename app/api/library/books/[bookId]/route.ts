// GET   /api/library/books/[bookId] — library.view.
// PATCH /api/library/books/[bookId] — library.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { getBook, updateBook } from "@/lib/server/library/books";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ bookId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("library.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "library");
    const { bookId } = await params;
    return ok(await getBook(scope, bookId));
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ bookId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("library.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "library");
    const { bookId } = await params;
    return ok(await updateBook(scope, bookId, await readJson(request)));
  });
}
