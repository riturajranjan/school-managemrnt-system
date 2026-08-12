// DELETE /api/academics/enrollments/[id] — remove an enrollment. academics.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { unenroll } from "@/lib/server/academics/service";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("academics.manage");
    const scope = await requireOrgScope(ctx);
    const { id } = await params;
    return ok(await unenroll(scope, id));
  });
}
