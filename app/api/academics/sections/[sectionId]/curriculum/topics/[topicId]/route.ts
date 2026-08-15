// PATCH /api/academics/sections/[sectionId]/curriculum/topics/[topicId] —
// { status } — record this section's progress on one topic. Server derives
// staff/ownership; never trusts a client-supplied staffId.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { updateTopicProgress } from "@/lib/server/curriculum/service";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ sectionId: string; topicId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("curriculum.manage");
    const scope = await requireOrgScope(ctx);
    const { sectionId, topicId } = await params;
    return ok(await updateTopicProgress(scope, sectionId, topicId, await readJson(request)));
  });
}
