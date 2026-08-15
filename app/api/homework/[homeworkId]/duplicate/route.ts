// POST /api/homework/[homeworkId]/duplicate — a new DRAFT copy (same
// section/subject/staff/title/content, re-validated against the actor's real
// TeachingAssignment same as any create). homework.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { duplicateHomework } from "@/lib/server/homework/service";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ homeworkId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("homework.manage");
    const scope = await requireOrgScope(ctx);
    const { homeworkId } = await params;
    return ok(await duplicateHomework(scope, homeworkId));
  });
}
