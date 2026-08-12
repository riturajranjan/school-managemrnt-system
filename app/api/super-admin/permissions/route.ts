// GET /api/super-admin/permissions — the REAL platform role → area capability
// matrix, derived from the authz catalog (PERMISSIONS + PLATFORM_ROLE_PERMISSIONS).
// Read-only reference for the Super Admin Permissions page. Any platform admin.
import { handle, requirePlatformAdmin } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { buildPlatformPermissionMatrix } from "@/lib/server/authz/catalog";

export async function GET() {
  return handle(async () => {
    await requirePlatformAdmin();
    return ok(buildPlatformPermissionMatrix());
  });
}
