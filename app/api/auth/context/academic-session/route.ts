import { setAcademicSession } from "@/lib/server/context/service";
import { setHandler } from "@/lib/server/api/context-route";

// POST /api/auth/context/academic-session { academicSessionId } — validates the
// session belongs to the selected school, then persists.
export const POST = (request: Request) =>
  setHandler(request, "academicSessionId", setAcademicSession);
