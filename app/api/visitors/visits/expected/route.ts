// POST /api/visitors/visits/expected — schedule an expected visitor (no check-in yet). visitors.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { createExpectedVisit } from "@/lib/server/visitors/visits";

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("visitors.manage");
    const scope = await requireOrgScope(ctx);
    return ok(await createExpectedVisit(scope, await readJson(request)));
  });
}
