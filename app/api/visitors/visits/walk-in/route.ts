// POST /api/visitors/visits/walk-in — register + immediately check in a walk-in visitor, server-generated pass number. visitors.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { createWalkInVisit } from "@/lib/server/visitors/visits";

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("visitors.manage");
    const scope = await requireOrgScope(ctx);
    return ok(await createWalkInVisit(scope, await readJson(request)));
  });
}
