import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/db/prisma";
import { getEnv } from "@/lib/env";

// ---------------------------------------------------------------------------
// Better Auth server instance. Owns the User/Session/Account/Verification
// tables (see schema.prisma) — the single identity system for every role.
//
// Phase 16 wires email + password only. OTP / 2FA / trusted-device / SSO screens
// in the UI remain simulated until a later phase adds the matching plugins here.
// ---------------------------------------------------------------------------

const env = getEnv();

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    // Foundation-level: no email delivery configured yet, so don't block login
    // on verification. Tighten once transactional email lands.
    requireEmailVerification: false,
    minPasswordLength: 8,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh once per day
  },
  // nextCookies() MUST be last so Set-Cookie is attached on server actions.
  plugins: [nextCookies()],
});

export type Auth = typeof auth;
