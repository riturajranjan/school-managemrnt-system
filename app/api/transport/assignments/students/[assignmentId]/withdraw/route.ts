// POST /api/transport/assignments/students/[assignmentId]/withdraw — transport.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { withdrawStudentTransport } from "@/lib/server/transport/student-assignments";

export async function POST(request: NextRequest, { params }: { params: Promise<{ assignmentId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("transport.manage");
    const scope = await requireOrgScope(ctx);
    const { assignmentId } = await params;
    return ok(await withdrawStudentTransport(scope, assignmentId, await readJson(request)));
  });
}
