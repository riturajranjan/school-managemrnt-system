// DELETE /api/students/[studentId]/guardians/[guardianId] — unlink a guardian
// from a student (the Guardian record itself is preserved).
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { requireOrgScope } from "@/lib/server/api/scope";
import { ok } from "@/lib/server/api/response";
import { unlinkGuardianFromStudent } from "@/lib/server/guardians/service";

type Ctx = { params: Promise<{ studentId: string; guardianId: string }> };

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const ctx = await requirePermission("guardians.update");
    const scope = await requireOrgScope(ctx);
    const { studentId, guardianId } = await params;
    return ok(await unlinkGuardianFromStudent(scope, studentId, guardianId));
  });
}
