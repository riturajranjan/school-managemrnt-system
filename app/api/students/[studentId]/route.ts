// GET    /api/students/[studentId]  — full detail (identity, guardians, docs, timeline).
// PATCH  /api/students/[studentId]  — update profile (records a timeline event).
// DELETE /api/students/[studentId]  — archive (soft delete; never a hard delete).
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { requireOrgScope } from "@/lib/server/api/scope";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { archiveStudent, getStudentDetail, updateStudent } from "@/lib/server/students/service";

type Ctx = { params: Promise<{ studentId: string }> };

export async function GET(_request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const ctx = await requirePermission("students.view");
    const scope = await requireOrgScope(ctx);
    const { studentId } = await params;
    return ok(await getStudentDetail(scope, studentId));
  });
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const ctx = await requirePermission("students.update");
    const scope = await requireOrgScope(ctx);
    const { studentId } = await params;
    const body = await readJson(request);
    return ok(await updateStudent(scope, studentId, body));
  });
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const ctx = await requirePermission("students.archive");
    const scope = await requireOrgScope(ctx);
    const { studentId } = await params;
    return ok(await archiveStudent(scope, studentId));
  });
}
