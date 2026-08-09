import { getCurrentUser } from "@/lib/server/auth/current-user";
import { resolvePostLogin } from "@/lib/server/context/resolver";
import { fail, ok } from "@/lib/server/api/response";

// GET /api/auth/context/next — the resolver's next destination for the current
// user (auto-selects unambiguous context). Used by the selector pages to advance.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED", "Sign in required");
  try {
    return ok({ redirectTo: await resolvePostLogin(user.id) });
  } catch {
    return fail("SERVER_ERROR", "Could not resolve next step");
  }
}
