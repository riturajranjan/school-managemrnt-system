// POST /api/homework/[homeworkId]/close — PUBLISHED -> CLOSED only.
// homework.manage, ownership enforced server-side.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { closeHomework } from "@/lib/server/homework/service";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ homeworkId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("homework.manage");
    const scope = await requireOrgScope(ctx);
    const { homeworkId } = await params;
    return ok(await closeHomework(scope, homeworkId));
  });
}
