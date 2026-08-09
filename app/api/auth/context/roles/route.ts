import { getAssignedRoles } from "@/lib/server/context/service";
import { readHandler } from "@/lib/server/api/context-route";

// GET /api/auth/context/roles — roles actually assigned to the user.
export const GET = () => readHandler(getAssignedRoles);
