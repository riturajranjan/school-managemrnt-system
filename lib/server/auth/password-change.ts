// Real password-change capability (User & Access UX pass). Two distinct,
// clearly-separated paths — never conflated:
//   - changeOwnPassword: self-service, ALWAYS requires the caller's real
//     current password verified against their own stored hash.
//   - adminSetPassword: an authorized administrator setting a real password
//     directly for someone else's account. Never the target's current
//     password (the admin cannot know it) — gated instead by the exact same
//     users.manage + tenant + TEACHER-teaching-scope boundary every other
//     account-management action already uses, and explicitly blocked for the
//     actor's own account (self-service is the only path for that).
// Both reuse the existing Argon2id hashing (lib/server/password.ts) and the
// same strength policy as the invite-link setup flow — not a second auth
// system. Neither ever logs, stores, or returns a plaintext password.
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { parseInput } from "@/lib/server/validation";
import type { OrgScope } from "@/lib/server/api/scope";
import type { AuthzContext } from "@/lib/server/authz/permissions";
import { recordAudit } from "@/lib/server/api/audit";
import { hashPassword, verifyPassword } from "@/lib/server/password";
import { passwordStrengthSchema } from "@/lib/server/auth/password-setup";
import { isTeacherScopedActor, requireTeacherScopedTarget } from "@/lib/server/users/provisioning";

const changeOwnSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordStrengthSchema,
});

/**
 * Self-service password change. Works even before a school/role has been
 * selected (the forced first-login flow reaches this before OrgScope can be
 * resolved) — so this deliberately does NOT take an OrgScope, and the audit
 * write below is a minimal, best-effort one derived from the caller's own
 * tenant membership (schoolId omitted — the Prisma column is nullable) rather
 * than requiring a fully resolved scope for what is otherwise a real action.
 */
export async function changeOwnPassword(ctx: AuthzContext, raw: unknown): Promise<void> {
  const input = parseInput(changeOwnSchema, raw);
  const user = await prisma.user.findUnique({ where: { id: ctx.user.id }, select: { passwordHash: true } });
  if (!user?.passwordHash) throw new HttpError("VALIDATION_ERROR", "This account has no password set yet");
  const ok = await verifyPassword(user.passwordHash, input.currentPassword);
  if (!ok) throw new HttpError("INVALID_CREDENTIALS", "Current password is incorrect");

  const newHash = await hashPassword(input.newPassword);
  await prisma.user.update({ where: { id: ctx.user.id }, data: { passwordHash: newHash, passwordSetupRequired: false } });

  const membership = await prisma.tenantMembership.findFirst({ where: { userId: ctx.user.id, status: "ACTIVE" }, select: { tenantId: true } });
  if (membership) {
    await prisma.auditEvent.create({
      data: {
        tenantId: membership.tenantId,
        schoolId: null,
        actorUserId: ctx.user.id,
        actorName: ctx.user.name,
        action: "PASSWORD_CHANGED",
        entityType: "User",
        entityId: ctx.user.id,
      },
    });
  }
  // A pure platform admin (no tenant membership) has nothing to record here —
  // platform-side actions are audited by the separate platform audit system.
}

const adminSetSchema = z.object({
  newPassword: passwordStrengthSchema,
  forcePasswordChange: z.boolean().optional(),
});

/**
 * Administrator-triggered password reset — sets a real password directly, no
 * setup link ever generated. Same authorization boundary as every other
 * account-management action (users.manage + tenant scoping + TEACHER
 * teaching-scope narrowing, reusing isTeacherScopedActor/
 * requireTeacherScopedTarget from provisioning.ts — not a new permission
 * system). A SUSPENDED account must be reactivated first, matching the
 * identical existing rule in reissuePasswordSetup.
 */
export async function adminSetPassword(ctx: AuthzContext, scope: OrgScope, userId: string, raw: unknown): Promise<void> {
  if (userId === ctx.user.id) {
    throw new HttpError("ROLE_NOT_ALLOWED", "Use the self-service password change for your own account");
  }
  const input = parseInput(adminSetSchema, raw);

  const membership = await prisma.tenantMembership.findUnique({
    where: { userId_tenantId: { userId, tenantId: scope.tenantId } },
    select: { id: true },
  });
  if (!membership) throw new HttpError("USER_NOT_FOUND", "User not found");
  if (await isTeacherScopedActor(ctx, scope)) await requireTeacherScopedTarget(scope, ctx.user.id, userId);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { status: true } });
    if (!user) throw new HttpError("USER_NOT_FOUND", "User not found");
    if (user.status === "SUSPENDED") throw new HttpError("ACCOUNT_INACTIVE", "Reactivate this account before resetting its password");

    const passwordHash = await hashPassword(input.newPassword);
    await tx.user.update({
      where: { id: userId },
      data: { passwordHash, status: "ACTIVE", passwordSetupRequired: input.forcePasswordChange ?? false },
    });
    // Any outstanding invite/setup link is now moot — a real password was just set directly.
    await tx.passwordSetupToken.updateMany({ where: { userId, consumedAt: null }, data: { consumedAt: new Date() } });
    await recordAudit(tx, scope, "PASSWORD_RESET", "User", userId, { adminReset: true, forcePasswordChange: input.forcePasswordChange ?? false });
  });
}
