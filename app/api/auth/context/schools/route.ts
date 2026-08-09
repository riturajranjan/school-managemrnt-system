import { getAccessibleSchools } from "@/lib/server/context/service";
import { readHandler } from "@/lib/server/api/context-route";

// GET /api/auth/context/schools — schools the user may access (tenant-scoped).
export const GET = () => readHandler(getAccessibleSchools);
