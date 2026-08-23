// PATCH /api/users/[userId]/status — suspend or reactivate an account. Never a
// hard delete: Staff/Student/Guardian history, Payroll, Attendance, Homework,
// etc. are all untouched. users.manage required, target must be in the
// caller's own tenant.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { setAccountStatus } from "@/lib/server/users/provisioning";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("users.manage");
    const scope = await requireOrgScope(ctx);
    const { userId } = await params;
    await setAccountStatus(scope, userId, await readJson(request));
    return ok({ success: true });
  });
}
