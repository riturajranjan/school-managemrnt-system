// POST /api/students/import — bulk-create students from a validated canonical
// DTO ({ students: [...] }). All-or-nothing; org scope from server context.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { requireOrgScope } from "@/lib/server/api/scope";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { importStudents } from "@/lib/server/students/import-service";

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("students.create");
    const scope = await requireOrgScope(ctx);
    const body = await readJson(request);
    const result = await importStudents(scope, body);

    if (!result.ok) {
      // Row-level validation failure — standard envelope with a `details` array.
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "IMPORT_VALIDATION_ERROR",
            message: "Some rows contain invalid data",
            details: result.details,
          },
        },
        { status: 400 },
      );
    }
    return ok({ imported: result.imported, failed: result.failed, studentIds: result.studentIds });
  });
}
