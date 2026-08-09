import { setRole } from "@/lib/server/context/service";
import { setHandler } from "@/lib/server/api/context-route";

// POST /api/auth/context/role { roleId } — validates assignment, persists.
export const POST = (request: Request) => setHandler(request, "roleId", setRole);
