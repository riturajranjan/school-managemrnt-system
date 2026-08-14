// GET  /api/exams/terms — exam terms for the active academic session. exams.view.
// POST /api/exams/terms — create a term. exams.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { createTerm, listTerms } from "@/lib/server/exams/service";

export async function GET() {
  return handle(async () => {
    const ctx = await requirePermission("exams.view");
    const scope = await requireOrgScope(ctx);
    return ok(await listTerms(scope));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("exams.manage");
    const scope = await requireOrgScope(ctx);
    return ok(await createTerm(scope, await readJson(request)));
  });
}
