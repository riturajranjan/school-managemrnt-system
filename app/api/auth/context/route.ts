import { getCurrentUser } from "@/lib/server/auth/current-user";
import { getCurrentContext } from "@/lib/server/context/service";
import { fail, ok } from "@/lib/server/api/response";

// GET /api/auth/context — the user's fully-resolved current workspace context.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED", "Sign in required");
  try {
    return ok(await getCurrentContext(user.id));
  } catch {
    return fail("SERVER_ERROR", "Could not load context");
  }
}
