// PATCH /api/curriculum/topics/[topicId] — edit title/order/learningOutcomes.
// DELETE — only while the parent curriculum is DRAFT (or 409 if a lesson plan
// still references this topic).
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { deleteTopic, updateTopic } from "@/lib/server/curriculum/service";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ topicId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("curriculum.manage");
    const scope = await requireOrgScope(ctx);
    const { topicId } = await params;
    return ok(await updateTopic(scope, topicId, await readJson(request)));
  });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ topicId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("curriculum.manage");
    const scope = await requireOrgScope(ctx);
    const { topicId } = await params;
    return ok(await deleteTopic(scope, topicId));
  });
}
