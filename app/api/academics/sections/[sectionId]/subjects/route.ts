// GET /api/academics/sections/[sectionId]/subjects — the subjects a section
// inherits from its class (Section→Class→ClassSubject→Subject). academics.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getSubjectsForSection } from "@/lib/server/academics/class-subjects-service";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ sectionId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("academics.view");
    const scope = await requireOrgScope(ctx);
    const { sectionId } = await params;
    return ok(await getSubjectsForSection(scope, sectionId));
  });
}
