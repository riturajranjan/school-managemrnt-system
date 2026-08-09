// Shared Route-Handler helpers for the context endpoints: auth guard, standard
// envelope, body validation, and ContextError → API-error mapping.
import { getCurrentUser } from "@/lib/server/auth/current-user";
import { ContextError } from "@/lib/server/context/service";
import { fail, ok } from "./response";

function mapError(error: unknown) {
  if (error instanceof ContextError) return fail(error.code, error.message);
  return fail("SERVER_ERROR", "Something went wrong");
}

/** GET list/read handler: requires auth, runs the loader, returns `ok(data)`. */
export async function readHandler<T>(loader: (userId: string) => Promise<T>) {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED", "Sign in required");
  try {
    return ok(await loader(user.id));
  } catch (error) {
    return mapError(error);
  }
}

/**
 * POST set handler: requires auth, reads a single string field from the JSON
 * body, runs the validated setter, and echoes the accepted id.
 */
export async function setHandler(
  request: Request,
  field: string,
  setter: (userId: string, id: string) => Promise<void>,
) {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED", "Sign in required");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("VALIDATION_ERROR", "Invalid JSON body");
  }
  const value = (body as Record<string, unknown> | null)?.[field];
  if (typeof value !== "string" || value.trim() === "") {
    return fail("VALIDATION_ERROR", `${field} is required`);
  }

  try {
    await setter(user.id, value);
    return ok({ [field]: value });
  } catch (error) {
    return mapError(error);
  }
}
