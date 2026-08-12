// GET  /api/academics/classes — real classes for the active school + session.
// POST /api/academics/classes — create a class. academics.view / academics.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { createClass, listClasses } from "@/lib/server/academics/service";

export async function GET() {
  return handle(async () => {
    const ctx = await requirePermission("academics.view");
    const scope = await requireOrgScope(ctx);
    return ok(await listClasses(scope));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("academics.manage");
    const scope = await requireOrgScope(ctx);
    return ok(await createClass(scope, await readJson(request)));
  });
}
