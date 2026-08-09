import { getCurrentUser } from "@/lib/server/auth/current-user";
import { ContextError, getAccessibleBranches, getCurrentContext } from "@/lib/server/context/service";
import { fail, ok } from "@/lib/server/api/response";

// GET /api/auth/context/branches?schoolId= — branches of the given (or active)
// school that the user can access. Empty list if no school is selected.
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
    return ok(await getAccessibleBranches(user.id, schoolId));
  } catch (error) {
    if (error instanceof ContextError) return fail(error.code, error.message);
    return fail("SERVER_ERROR", "Could not load branches");
  }
}
