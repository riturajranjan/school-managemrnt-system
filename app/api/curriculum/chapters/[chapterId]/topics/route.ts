// POST /api/curriculum/chapters/[chapterId]/topics — add a topic to a chapter.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { createTopic } from "@/lib/server/curriculum/service";

export async function POST(request: NextRequest, { params }: { params: Promise<{ chapterId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("curriculum.manage");
    const scope = await requireOrgScope(ctx);
    const { chapterId } = await params;
    return ok(await createTopic(scope, chapterId, await readJson(request)));
  });
}
