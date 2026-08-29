// Self-service account security — change-my-own-password and manage-my-own
// sessions. Identity-scoped (this user's own User/Session rows), never a new
// authentication system: password changes go through the same
// hashPassword/verifyPassword used everywhere else, and a session is the same
// real Session row Login/Logout already manage.
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { hashPassword, verifyPassword } from "@/lib/server/password";
import { HttpError } from "@/lib/server/api/guard";
import { parseInput } from "@/lib/server/validation";
import type { MySessionDto } from "@/lib/api/contracts";

// Mirrors the policy already enforced in lib/server/auth/password-setup.ts —
// one real password policy, applied consistently wherever a password is set.
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Za-z]/, "Password must include a letter")
    .regex(/[0-9]/, "Password must include a number"),
});

export async function changeOwnPassword(userId: string, raw: unknown): Promise<void> {
  const input = parseInput(changePasswordSchema, raw);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true } });
  if (!user.passwordHash || !(await verifyPassword(user.passwordHash, input.currentPassword))) {
    throw new HttpError("INVALID_CURRENT_PASSWORD", "Current password is incorrect");
  }
  const passwordHash = await hashPassword(input.newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}

export async function listMySessions(userId: string, currentSessionId: string): Promise<MySessionDto[]> {
  const sessions = await prisma.session.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    select: { id: true, createdAt: true, expiresAt: true },
    orderBy: { createdAt: "desc" },
  });
  return sessions.map((s) => ({ id: s.id, createdAt: s.createdAt.toISOString(), expiresAt: s.expiresAt.toISOString(), isCurrent: s.id === currentSessionId }));
}

/** Revoke one of the caller's OWN sessions (never another user's) — signs that device out. */
export async function revokeMySession(userId: string, sessionId: string): Promise<void> {
  const result = await prisma.session.deleteMany({ where: { id: sessionId, userId } });
  if (result.count === 0) throw new HttpError("NOT_FOUND", "Session not found");
}
