import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth/auth";

// Better Auth mounts its full endpoint surface (sign-in, sign-out, session, …)
// under /api/auth/* via this catch-all handler.
export const { GET, POST } = toNextJsHandler(auth);
