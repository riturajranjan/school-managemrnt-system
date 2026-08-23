// POST /api/auth/setup-password — completes the real first-login password
// setup for an INVITED account provisioned via the hierarchical account
// system. Public (no session) — the caller isn't logged in yet; the one-time
// token itself is the credential. Never a second authentication system: this
// only ever sets a password on the same User row the normal Login API checks.
import type { NextRequest } from "next/server";
import { handle } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { completePasswordSetup } from "@/lib/server/auth/password-setup";

export async function POST(request: NextRequest) {
  return handle(async () => ok(await completePasswordSetup(await readJson(request))));
}
