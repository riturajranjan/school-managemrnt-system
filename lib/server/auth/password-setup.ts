// Real first-login password setup (Phase 9W.2). An account provisioned by an
// authorized actor is created INVITED with no password; this is the ONLY way
// it ever gets one. Not a second authentication system — completing setup
// only ever sets User.passwordHash + flips status to ACTIVE on the SAME User
// row the normal Login API already authenticates against.
//
// No email provider exists in this system, so the raw setup token is returned
// ONCE, directly in the provisioning API response, for the provisioning actor
// to share manually. It is never persisted anywhere except as a SHA-256 hash
// (same pattern as Session.tokenHash) and never appears in logs or AuditEvent
// metadata.
import { z } from "zod";
import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/server/password";
import { generateSessionToken, hashToken } from "@/lib/server/auth/tokens";
import { HttpError } from "@/lib/server/api/guard";
import { parseInput } from "@/lib/server/validation";

const SETUP_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Create a one-time password-setup token for a User (called inside the same
 * transaction as account provisioning). Returns the RAW token — the only time
 * it is ever available in plaintext.
 */
export async function createPasswordSetupToken(db: Prisma.TransactionClient, userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SETUP_TOKEN_TTL_MS);
  await db.passwordSetupToken.create({
    data: { userId, tokenHash: hashToken(token), expiresAt },
  });
  return { token, expiresAt };
}

const newPasswordSchema = z.object({
  token: z.string().min(1, "Missing token"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Za-z]/, "Password must include a letter")
    .regex(/[0-9]/, "Password must include a number"),
});

/**
 * Complete password setup: verify the token (unconsumed, unexpired), hash the
 * new password, activate the account, and consume the token. Never logs or
 * returns the plaintext password.
 */
export async function completePasswordSetup(raw: unknown): Promise<{ email: string }> {
  const input = parseInput(newPasswordSchema, raw);
  const tokenHash = hashToken(input.token);

  return prisma.$transaction(async (tx) => {
    const row = await tx.passwordSetupToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, consumedAt: true, user: { select: { email: true, status: true } } },
    });
    if (!row || row.consumedAt || row.expiresAt < new Date()) {
      throw new HttpError("INVALID_SETUP_TOKEN", "This setup link is invalid or has expired");
    }
    if (row.user.status === "SUSPENDED" || row.user.status === "INACTIVE") {
      throw new HttpError("ACCOUNT_INACTIVE", "This account is no longer active");
    }

    const passwordHash = await hashPassword(input.password);
    await tx.user.update({
      where: { id: row.userId },
      data: { passwordHash, status: "ACTIVE", passwordSetupRequired: false, emailVerifiedAt: new Date() },
    });
    await tx.passwordSetupToken.update({ where: { id: row.id }, data: { consumedAt: new Date() } });
    // Every other outstanding setup token for this user is now moot.
    await tx.passwordSetupToken.updateMany({
      where: { userId: row.userId, consumedAt: null, id: { not: row.id } },
      data: { consumedAt: new Date() },
    });

    return { email: row.user.email };
  });
}
