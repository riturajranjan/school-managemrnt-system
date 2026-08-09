import { getCurrentUser } from "@/lib/server/auth/current-user";
import { ContextError, getAcademicSessions, getCurrentContext } from "@/lib/server/context/service";
import { fail, ok } from "@/lib/server/api/response";

// GET /api/auth/context/academic-sessions?schoolId= — sessions of the given (or
// active) school. The current session is flagged via `isCurrent`.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED", "Sign in required");

  let schoolId = new URL(request.url).searchParams.get("schoolId");
  if (!schoolId) {
    const ctx = await getCurrentContext(user.id);
    schoolId = ctx.school?.id ?? null;
  }
  if (!schoolId) return ok([]);

  try {
    return ok(await getAcademicSessions(user.id, schoolId));
  } catch (error) {
    if (error instanceof ContextError) return fail(error.code, error.message);
    return fail("SERVER_ERROR", "Could not load academic sessions");
  }
}
