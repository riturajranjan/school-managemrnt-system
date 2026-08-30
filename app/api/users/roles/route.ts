// GET /api/users/roles — every real system role, for the User List's "Role"
// filter dropdown. Distinct from GET /api/users/provisionable-roles (which is
// policy-gated to what the actor may CREATE); this is unfiltered because
// knowing role names is not sensitive — listAccounts already returns them.
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { listAllRoleOptions } from "@/lib/server/users/provisioning";

export async function GET() {
  return handle(async () => {
    await requirePermission("users.manage");
    return ok(await listAllRoleOptions());
  });
}
