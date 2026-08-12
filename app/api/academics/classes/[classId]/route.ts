// GET   /api/academics/classes/[classId] — class + its sections.
// PATCH /api/academics/classes/[classId] — update class. academics.view/manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getClass, updateClass } from "@/lib/server/academics/service";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ classId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("academics.view");
    const scope = await requireOrgScope(ctx);
    const { classId } = await params;
    return ok(await getClass(scope, classId));
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ classId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("academics.manage");
    const scope = await requireOrgScope(ctx);
    const { classId } = await params;
    return ok(await updateClass(scope, classId, await readJson(request)));
  });
}
