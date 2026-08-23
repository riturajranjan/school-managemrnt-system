// Hierarchical account provisioning (Phase 9W.2) — the ONE real entry point
// through which any tenant-side actor creates or links a login account for a
// real domain record (Staff/Student/Guardian). Reuses the existing identity
// system end to end: User, TenantMembership, RoleAssignment, Staff.userId,
// Student.userId, Guardian.userId, AuditEvent. No parallel auth system, no
// parallel role vocabulary — see lib/server/authz/role-creation-policy.ts for
// the actor→target authorization map and lib/server/authz/catalog.ts for the
// real permission catalog these roles carry.
import { z } from "zod";
import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { parseInput } from "@/lib/server/validation";
import type { OrgScope } from "@/lib/server/api/scope";
import type { AuthzContext } from "@/lib/server/authz/permissions";
import { recordAudit } from "@/lib/server/api/audit";
import { createPasswordSetupToken } from "@/lib/server/auth/password-setup";
import {
  canProvisionRole,
  provisionableRoleKeysFor,
  STAFF_LINKED_ROLE_KEYS,
  STUDENT_ROLE_KEY,
  GUARDIAN_ROLE_KEY,
} from "@/lib/server/authz/role-creation-policy";

type Tx = Prisma.TransactionClient;

// --- Provisionable roles -----------------------------------------------------

export async function getProvisionableRoles(ctx: AuthzContext): Promise<{ key: string; name: string }[]> {
  const keys = provisionableRoleKeysFor(ctx.activeRoleKey);
  if (keys.length === 0) return [];
  const roles = await prisma.role.findMany({
    where: { key: { in: [...keys] }, isSystem: true },
    select: { key: true, name: true },
    orderBy: { name: "asc" },
  });
  return roles;
}

// --- Provision / link ---------------------------------------------------------

const provisionSchema = z.object({
  targetRoleKey: z.string().min(1),
  email: z.string().email().transform((s) => s.toLowerCase()),
  name: z.string().trim().min(1).max(200).optional(),
  staffId: z.string().min(1).optional(),
  studentId: z.string().min(1).optional(),
  guardianId: z.string().min(1).optional(),
});

export type ProvisionAccountResult = {
  userId: string;
  targetRoleKey: string;
  accountCreated: boolean; // a brand-new User row was created
  accountLinked: boolean; // Staff/Student/Guardian.userId was (re)linked
  passwordSetupPending: boolean; // true unless reusing an already-ACTIVE user
  passwordSetupUrl: string | null; // relative path; null when nothing to set up
};

/**
 * Provision (or link) a login account for a real domain record, on behalf of
 * `ctx` (the caller). `scope` is the caller's server-validated OrgScope — the
 * target Staff/Student/Guardian must belong to the SAME tenant (Staff/Student:
 * same school too). The target role is checked against ROLE_CREATION_POLICY
 * using ctx.activeRoleKey — never a role claimed by the request body.
 */
export async function provisionAccount(ctx: AuthzContext, scope: OrgScope, raw: unknown): Promise<ProvisionAccountResult> {
  const input = parseInput(provisionSchema, raw);

  if (!canProvisionRole(ctx.activeRoleKey, input.targetRoleKey)) {
    throw new HttpError("ROLE_NOT_ALLOWED", `Your role may not provision a ${input.targetRoleKey} account`);
  }

  const targetRole = await prisma.role.findFirst({ where: { key: input.targetRoleKey, isSystem: true }, select: { id: true } });
  if (!targetRole) throw new HttpError("TARGET_ROLE_NOT_FOUND", "That role is not configured");

  if ((STAFF_LINKED_ROLE_KEYS as readonly string[]).includes(input.targetRoleKey)) {
    if (!input.staffId) throw new HttpError("VALIDATION_ERROR", "staffId is required for this role");
    return provisionStaffLinked(ctx, scope, input.targetRoleKey, targetRole.id, input.staffId, input.email, input.name);
  }
  if (input.targetRoleKey === STUDENT_ROLE_KEY) {
    if (!input.studentId) throw new HttpError("VALIDATION_ERROR", "studentId is required for a Student account");
    return provisionStudent(ctx, scope, targetRole.id, input.studentId, input.email, input.name);
  }
  if (input.targetRoleKey === GUARDIAN_ROLE_KEY) {
    if (!input.guardianId) throw new HttpError("VALIDATION_ERROR", "guardianId is required for a Guardian account");
    return provisionGuardian(ctx, scope, targetRole.id, input.guardianId, input.email, input.name);
  }
  // Unreachable: every key in ROLE_CREATION_POLICY is one of the three shapes above.
  throw new HttpError("TARGET_ROLE_NOT_FOUND", "Unsupported target role shape");
}

/** Find-or-create the User for `email` inside `tx`, matching the existing school-provisioning pattern: reuse silently, never touch an existing password. */
async function findOrCreateUser(tx: Tx, email: string, name: string | undefined): Promise<{ id: string; isNew: boolean; status: string }> {
  const existing = await tx.user.findUnique({ where: { email }, select: { id: true, status: true } });
  if (existing) return { id: existing.id, isNew: false, status: existing.status };
  const created = await tx.user.create({
    data: { email, name: name ?? null, passwordHash: null, status: "INVITED", passwordSetupRequired: true },
    select: { id: true, status: true },
  });
  return { id: created.id, isNew: true, status: created.status };
}

/**
 * When reusing an existing User (found by email), a Staff/Student/Guardian
 * link is a global 1:1 (each column is `userId @unique`) — one User can never
 * be linked to two Staff rows (or two Students, or two Guardians). Without
 * this check the attempt still fails safely via the DB unique constraint, but
 * as a raw, unhandled Prisma error; this turns it into the same typed
 * CONFLICT the rest of the API surface uses.
 */
async function assertNotLinkedToADifferentRecord(tx: Tx, kind: "staff" | "student" | "guardian", userId: string, targetId: string): Promise<void> {
  const existing =
    kind === "staff"
      ? await tx.staff.findUnique({ where: { userId }, select: { id: true } })
      : kind === "student"
        ? await tx.student.findUnique({ where: { userId }, select: { id: true } })
        : await tx.guardian.findUnique({ where: { userId }, select: { id: true } });
  if (existing && existing.id !== targetId) {
    throw new HttpError("ACCOUNT_ALREADY_LINKED_ELSEWHERE", `This email's account is already linked to a different ${kind} record`);
  }
}

/** Ensure a TenantMembership + RoleAssignment exist for (userId, tenantId, roleId). Idempotent. */
async function ensureMembershipAndRole(tx: Tx, userId: string, tenantId: string, roleId: string): Promise<void> {
  const membership = await tx.tenantMembership.upsert({
    where: { userId_tenantId: { userId, tenantId } },
    update: {},
    create: { userId, tenantId, status: "ACTIVE" },
    select: { id: true },
  });
  await tx.roleAssignment.upsert({
    where: { membershipId_roleId: { membershipId: membership.id, roleId } },
    update: {},
    create: { membershipId: membership.id, roleId },
  });
}

/** Issue a setup token for a newly-created or still-INVITED user; null for an already-ACTIVE one. */
async function maybeIssueSetupToken(tx: Tx, userId: string, userStatus: string): Promise<string | null> {
  if (userStatus === "ACTIVE") return null;
  const { token } = await createPasswordSetupToken(tx, userId);
  return `/setup-password?token=${token}`;
}

async function provisionStaffLinked(
  ctx: AuthzContext,
  scope: OrgScope,
  targetRoleKey: string,
  targetRoleId: string,
  staffId: string,
  email: string,
  name: string | undefined,
): Promise<ProvisionAccountResult> {
  return prisma.$transaction(async (tx) => {
    const staff = await tx.staff.findFirst({
      where: { id: staffId, tenantId: scope.tenantId, schoolId: scope.schoolId },
      select: { id: true, userId: true, firstName: true, lastName: true, isTeaching: true },
    });
    if (!staff) throw new HttpError("NOT_FOUND", "Staff record not found");
    if (staff.userId) throw new HttpError("STAFF_ALREADY_LINKED", "This Staff record already has a login account");
    if (targetRoleKey === "TEACHER" && !staff.isTeaching) {
      throw new HttpError("VALIDATION_ERROR", "TEACHER accounts may only be provisioned for a Staff record with isTeaching = true");
    }
    if (targetRoleKey === "STAFF") {
      // Transport Manager's target must be real transport-scope staff; HR
      // Admin's target may be any real, unlinked Staff record in the school.
      if (ctx.activeRoleKey === "TRANSPORT_MANAGER") {
        const inTransportScope =
          (await tx.transportRouteAssignment.count({ where: { OR: [{ driverStaffId: staffId }, { attendantStaffId: staffId }] } })) > 0 ||
          (await tx.staffTransportAssignment.count({ where: { staffId } })) > 0 ||
          (await tx.transportTrip.count({ where: { OR: [{ driverStaffId: staffId }, { attendantStaffId: staffId }] } })) > 0;
        if (!inTransportScope) {
          throw new HttpError("VALIDATION_ERROR", "This Staff record has no real Transport assignment — Transport Manager may only provision accounts for staff in transport scope");
        }
      }
    }

    const displayName = name ?? [staff.firstName, staff.lastName].filter(Boolean).join(" ");
    const user = await findOrCreateUser(tx, email, displayName || undefined);
    await assertNotLinkedToADifferentRecord(tx, "staff", user.id, staff.id);
    await ensureMembershipAndRole(tx, user.id, scope.tenantId, targetRoleId);
    // Atomic conditional update (compare-and-swap on userId IS NULL) — closes
    // the race where two concurrent requests both pass the `!staff.userId`
    // check above before either commits. Only one can win this WHERE clause.
    const linked = await tx.staff.updateMany({ where: { id: staff.id, userId: null }, data: { userId: user.id } });
    if (linked.count === 0) throw new HttpError("STAFF_ALREADY_LINKED", "This Staff record already has a login account");
    const passwordSetupUrl = await maybeIssueSetupToken(tx, user.id, user.status);

    await recordAudit(tx, scope, "USER_ACCOUNT_PROVISIONED", "User", user.id, { targetRoleKey, staffId, accountCreated: user.isNew });
    await recordAudit(tx, scope, "USER_ROLE_ASSIGNED", "User", user.id, { roleKey: targetRoleKey });
    await recordAudit(tx, scope, "USER_ACCOUNT_LINKED", "Staff", staff.id, { userId: user.id });

    return {
      userId: user.id,
      targetRoleKey,
      accountCreated: user.isNew,
      accountLinked: true,
      passwordSetupPending: passwordSetupUrl !== null,
      passwordSetupUrl,
    };
  });
}

async function provisionStudent(
  ctx: AuthzContext,
  scope: OrgScope,
  targetRoleId: string,
  studentId: string,
  email: string,
  name: string | undefined,
): Promise<ProvisionAccountResult> {
  void ctx;
  return prisma.$transaction(async (tx) => {
    const student = await tx.student.findFirst({
      where: { id: studentId, tenantId: scope.tenantId, schoolId: scope.schoolId },
      select: { id: true, userId: true, firstName: true, lastName: true, status: true },
    });
    if (!student) throw new HttpError("NOT_FOUND", "Student not found");
    if (student.userId) throw new HttpError("STUDENT_ALREADY_LINKED", "This Student already has a login account");
    if (student.status !== "ACTIVE") throw new HttpError("VALIDATION_ERROR", "Only an ACTIVE student may be provisioned a login account");

    const displayName = name ?? [student.firstName, student.lastName].filter(Boolean).join(" ");
    const user = await findOrCreateUser(tx, email, displayName || undefined);
    await assertNotLinkedToADifferentRecord(tx, "student", user.id, student.id);
    await ensureMembershipAndRole(tx, user.id, scope.tenantId, targetRoleId);
    // Atomic conditional update — see the identical comment in provisionStaffLinked.
    const linked = await tx.student.updateMany({ where: { id: student.id, userId: null }, data: { userId: user.id } });
    if (linked.count === 0) throw new HttpError("STUDENT_ALREADY_LINKED", "This Student already has a login account");
    const passwordSetupUrl = await maybeIssueSetupToken(tx, user.id, user.status);

    await recordAudit(tx, scope, "USER_ACCOUNT_PROVISIONED", "User", user.id, { targetRoleKey: STUDENT_ROLE_KEY, studentId, accountCreated: user.isNew });
    await recordAudit(tx, scope, "USER_ROLE_ASSIGNED", "User", user.id, { roleKey: STUDENT_ROLE_KEY });
    await recordAudit(tx, scope, "USER_ACCOUNT_LINKED", "Student", student.id, { userId: user.id });

    return {
      userId: user.id,
      targetRoleKey: STUDENT_ROLE_KEY,
      accountCreated: user.isNew,
      accountLinked: true,
      passwordSetupPending: passwordSetupUrl !== null,
      passwordSetupUrl,
    };
  });
}

async function provisionGuardian(
  ctx: AuthzContext,
  scope: OrgScope,
  targetRoleId: string,
  guardianId: string,
  email: string,
  name: string | undefined,
): Promise<ProvisionAccountResult> {
  void ctx;
  return prisma.$transaction(async (tx) => {
    const guardian = await tx.guardian.findFirst({
      where: { id: guardianId, tenantId: scope.tenantId },
      select: { id: true, userId: true, firstName: true, lastName: true, students: { select: { studentId: true }, take: 1 } },
    });
    if (!guardian) throw new HttpError("NOT_FOUND", "Guardian not found");
    if (guardian.userId) throw new HttpError("GUARDIAN_ALREADY_LINKED", "This Guardian already has a login account");
    if (guardian.students.length === 0) {
      throw new HttpError("GUARDIAN_NOT_LINKED_TO_STUDENT", "This Guardian has no real StudentGuardian relationship — cannot provision a parent login for an unconnected record");
    }

    const displayName = name ?? [guardian.firstName, guardian.lastName].filter(Boolean).join(" ");
    const user = await findOrCreateUser(tx, email, displayName || undefined);
    await assertNotLinkedToADifferentRecord(tx, "guardian", user.id, guardian.id);
    await ensureMembershipAndRole(tx, user.id, scope.tenantId, targetRoleId);
    // Atomic conditional update — see the identical comment in provisionStaffLinked.
    const linked = await tx.guardian.updateMany({ where: { id: guardian.id, userId: null }, data: { userId: user.id } });
    if (linked.count === 0) throw new HttpError("GUARDIAN_ALREADY_LINKED", "This Guardian already has a login account");
    const passwordSetupUrl = await maybeIssueSetupToken(tx, user.id, user.status);

    await recordAudit(tx, scope, "USER_ACCOUNT_PROVISIONED", "User", user.id, { targetRoleKey: GUARDIAN_ROLE_KEY, guardianId, accountCreated: user.isNew });
    await recordAudit(tx, scope, "USER_ROLE_ASSIGNED", "User", user.id, { roleKey: GUARDIAN_ROLE_KEY });
    await recordAudit(tx, scope, "USER_ACCOUNT_LINKED", "Guardian", guardian.id, { userId: user.id });

    return {
      userId: user.id,
      targetRoleKey: GUARDIAN_ROLE_KEY,
      accountCreated: user.isNew,
      accountLinked: true,
      passwordSetupPending: passwordSetupUrl !== null,
      passwordSetupUrl,
    };
  });
}

// --- List / detail ------------------------------------------------------------

export type AccountListItem = {
  id: string;
  name: string | null;
  email: string;
  status: string;
  passwordSetupRequired: boolean;
  roles: { key: string; name: string }[];
  staffId: string | null;
  studentId: string | null;
  guardianId: string | null;
  createdAt: string;
};

/** List every real User with a TenantMembership in the caller's tenant. `users.manage` required (enforced by the route). */
export async function listAccounts(scope: OrgScope, raw: { page?: number; pageSize?: number; search?: string | null }): Promise<{ data: AccountListItem[]; meta: { page: number; pageSize: number; total: number; totalPages: number } }> {
  const page = Math.max(1, raw.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, raw.pageSize ?? 25));
  const search = raw.search?.trim();

  const where: Prisma.TenantMembershipWhereInput = {
    tenantId: scope.tenantId,
    ...(search ? { user: { OR: [{ email: { contains: search, mode: "insensitive" } }, { name: { contains: search, mode: "insensitive" } }] } } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.tenantMembership.count({ where }),
    prisma.tenantMembership.findMany({
      where,
      select: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            passwordSetupRequired: true,
            createdAt: true,
            staffProfile: { select: { id: true } },
            studentProfile: { select: { id: true } },
            guardianProfile: { select: { id: true } },
          },
        },
        roleAssignments: { select: { role: { select: { key: true, name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    data: rows.map((r) => ({
      id: r.user.id,
      name: r.user.name,
      email: r.user.email,
      status: r.user.status,
      passwordSetupRequired: r.user.passwordSetupRequired,
      roles: r.roleAssignments.map((ra) => ra.role),
      staffId: r.user.staffProfile?.id ?? null,
      studentId: r.user.studentProfile?.id ?? null,
      guardianId: r.user.guardianProfile?.id ?? null,
      createdAt: r.user.createdAt.toISOString(),
    })),
    meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

async function requireUserInTenant(userId: string, tenantId: string): Promise<void> {
  const membership = await prisma.tenantMembership.findUnique({ where: { userId_tenantId: { userId, tenantId } }, select: { id: true } });
  if (!membership) throw new HttpError("USER_NOT_FOUND", "User not found in your school");
}

// --- Status -------------------------------------------------------------------

const statusSchema = z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]) });

/** Suspend or reactivate a user's account. Never a hard delete — see spec §32. */
export async function setAccountStatus(scope: OrgScope, userId: string, raw: unknown): Promise<void> {
  const input = parseInput(statusSchema, raw);
  await requireUserInTenant(userId, scope.tenantId);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { status: true } });
    if (!user) throw new HttpError("USER_NOT_FOUND", "User not found");
    if (user.status === "SUSPENDED" && input.status === "SUSPENDED") return;
    if (user.status !== "SUSPENDED" && user.status !== "ACTIVE" && input.status === "ACTIVE") {
      throw new HttpError("VALIDATION_ERROR", "Only a suspended account can be reactivated this way");
    }
    await tx.user.update({ where: { id: userId }, data: { status: input.status } });
    await recordAudit(tx, scope, input.status === "SUSPENDED" ? "USER_ACCOUNT_SUSPENDED" : "USER_ACCOUNT_ACTIVATED", "User", userId, {});
  });
}

// --- Assign an additional role to an existing account --------------------------

const assignRoleSchema = z.object({ targetRoleKey: z.string().min(1) });

/** Grant an existing user an additional role, subject to the SAME ROLE_CREATION_POLICY as fresh provisioning. */
export async function assignRoleToAccount(ctx: AuthzContext, scope: OrgScope, userId: string, raw: unknown): Promise<void> {
  const input = parseInput(assignRoleSchema, raw);
  if (!canProvisionRole(ctx.activeRoleKey, input.targetRoleKey)) {
    throw new HttpError("ROLE_NOT_ALLOWED", `Your role may not assign a ${input.targetRoleKey} role`);
  }
  await requireUserInTenant(userId, scope.tenantId);

  const role = await prisma.role.findFirst({ where: { key: input.targetRoleKey, isSystem: true }, select: { id: true } });
  if (!role) throw new HttpError("TARGET_ROLE_NOT_FOUND", "That role is not configured");

  await prisma.$transaction(async (tx) => {
    await ensureMembershipAndRole(tx, userId, scope.tenantId, role.id);
    await recordAudit(tx, scope, "USER_ROLE_ASSIGNED", "User", userId, { roleKey: input.targetRoleKey });
  });
}
