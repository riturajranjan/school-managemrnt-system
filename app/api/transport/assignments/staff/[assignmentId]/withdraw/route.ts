// POST /api/transport/assignments/staff/[assignmentId]/withdraw — transport.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { withdrawStaffTransport } from "@/lib/server/transport/staff-assignments";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ assignmentId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("transport.manage");
    const scope = await requireOrgScope(ctx);
    const { assignmentId } = await params;
    return ok(await withdrawStaffTransport(scope, assignmentId));
  });
}
