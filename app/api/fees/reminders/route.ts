// GET /api/fees/reminders — overdue reminder candidates (deliverable: false —
// no real Student/Guardian User account to notify in-app, no messaging
// provider). fees.view.
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { listFeeReminderCandidates } from "@/lib/server/fees/reminders";

export async function GET() {
  return handle(async () => {
    const ctx = await requirePermission("fees.view");
    const scope = await requireOrgScope(ctx);
    const data = await listFeeReminderCandidates(scope);
    return ok(data);
  });
}
