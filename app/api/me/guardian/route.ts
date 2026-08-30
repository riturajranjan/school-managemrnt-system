// POST /api/me/guardian — Student self-service "Add / Invite My Guardian".
// No permission check (STUDENT holds zero permissions by design, same as
// every other /api/me/* identity-scoped route) — authorization is identity
// only: the caller's own Student record, resolved server-side. Never accepts
// a studentId from the client.
import type { NextRequest } from "next/server";
import { handle, requireAuth } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { addMyGuardian } from "@/lib/server/students/self-guardian";

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requireAuth();
    const scope = await requireOrgScope(ctx);
    return ok(await addMyGuardian(scope, ctx.user.id, await readJson(request)));
  });
}
