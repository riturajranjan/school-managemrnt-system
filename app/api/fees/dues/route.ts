// GET /api/fees/dues?classId=&sectionId=&search= — per-student dues rows. fees.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { listStudentDues } from "@/lib/server/fees/dues";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("fees.view");
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    const data = await listStudentDues(scope, { classId: singleParam(sp, "classId"), sectionId: singleParam(sp, "sectionId"), search: singleParam(sp, "search") });
    return ok(data);
  });
}
