// DELETE /api/super-admin/domains/[id] — remove a domain record. platform.domains.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { deleteDomain } from "@/lib/server/platform/domains-service";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("platform.domains.manage");
    const { id } = await params;
    return ok(await deleteDomain({ actor: { id: ctx.user.id, name: ctx.user.name ?? null }, domainId: id }));
  });
}
