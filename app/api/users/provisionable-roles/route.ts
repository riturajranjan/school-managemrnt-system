// GET /api/users/provisionable-roles — the real, server-derived list of roles
// the caller may provision an account for (lib/server/authz/role-creation-policy.ts),
// keyed off the caller's REAL active role. The frontend must never maintain
// this policy independently. users.manage required.
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { getProvisionableRoles } from "@/lib/server/users/provisioning";

export async function GET() {
  return handle(async () => {
    const ctx = await requirePermission("users.manage");
    return ok(await getProvisionableRoles(ctx));
  });
}
