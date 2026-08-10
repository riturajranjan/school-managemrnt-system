// GET  /api/students  — paginated, filtered, tenant/school-scoped student list.
// POST /api/students  — create a student (server assigns tenant/school/branch/session).
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { requireOrgScope } from "@/lib/server/api/scope";
import { multiParam, parsePagination, readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { createStudent, listStudents, studentSortFields, type StudentSort } from "@/lib/server/students/service";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("students.view");
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    const { page, pageSize } = parsePagination(sp);
    const sortRaw = singleParam(sp, "sort");
    const sort = (studentSortFields as readonly string[]).includes(sortRaw ?? "") ? (sortRaw as StudentSort) : undefined;
    const order = singleParam(sp, "order") === "desc" ? "desc" : "asc";

    const { data, meta } = await listStudents(scope, {
      page,
      pageSize,
      search: singleParam(sp, "search"),
      status: multiParam(sp, "status"),
      admissionType: multiParam(sp, "admissionType"),
      gender: multiParam(sp, "gender"),
      classLabel: singleParam(sp, "classLabel"),
      sectionLabel: singleParam(sp, "sectionLabel"),
      branchId: singleParam(sp, "branchId"),
      academicSessionId: singleParam(sp, "academicSessionId"),
      sort,
      order,
    });
    return ok(data, meta);
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("students.create");
    const scope = await requireOrgScope(ctx);
    const body = await readJson(request);
    const student = await createStudent(scope, body);
    return ok(student);
  });
}
