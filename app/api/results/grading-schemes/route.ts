// GET  /api/results/grading-schemes — list real grading schemes. results.view.
// POST /api/results/grading-schemes — create a scheme (bands added separately
//      via PUT .../bands). exams.manage (grading config is exam administration).
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { createGradingScheme, listGradingSchemes } from "@/lib/server/results/grading-service";

export async function GET(_request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("results.view");
    const scope = await requireOrgScope(ctx);
    return ok(await listGradingSchemes(scope));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("exams.manage");
    const scope = await requireOrgScope(ctx);
    return ok(await createGradingScheme(scope, await readJson(request)));
  });
}
