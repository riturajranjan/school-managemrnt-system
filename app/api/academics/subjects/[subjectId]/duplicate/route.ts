// POST /api/academics/subjects/[subjectId]/duplicate — copy a subject into a new
// ACTIVE catalogue entry with a unique code. academics.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { duplicateSubject } from "@/lib/server/academics/subjects-service";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ subjectId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("academics.manage");
    const scope = await requireOrgScope(ctx);
    const { subjectId } = await params;
    return ok(await duplicateSubject(scope, subjectId));
  });
}
