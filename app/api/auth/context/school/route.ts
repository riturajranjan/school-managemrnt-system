import { setSchool } from "@/lib/server/context/service";
import { setHandler } from "@/lib/server/api/context-route";

// POST /api/auth/context/school { schoolId } — validates access, persists.
export const POST = (request: Request) => setHandler(request, "schoolId", setSchool);
