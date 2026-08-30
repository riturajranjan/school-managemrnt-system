// Hierarchical account provisioning (Phase 9W.2, finalized in the User
// Account Creation Foundation review) — the ONE real entry point through
// which any tenant-side actor creates or links a login account for a real
// domain record (Staff/Student/Guardian). Reuses the existing identity
// system end to end: User, TenantMembership, RoleAssignment, Staff.userId,
// Student.userId, Guardian.userId, AuditEvent. No parallel auth system, no
// parallel role vocabulary — see lib/server/authz/role-creation-policy.ts for
// the actor→target authorization map and lib/server/authz/catalog.ts for the
// real permission catalog these roles carry.
//
// A target role's underlying domain record can be EITHER an existing,
// unlinked one (staffId/studentId/guardianId) OR created inline in the same
// request (newStaff/newStudent/newGuardian) by calling the EXISTING
// createStaff/createStudent/linkGuardianToStudent services — never a second
// employee/student/guardian-creation system. Inline creation runs as its own
// transaction BEFORE the login-provisioning transaction (createStaff/
// createStudent open their own top-level transaction internally and cannot
// be nested inside this module's), so a crash between the two leaves a real,
// discoverable, unlinked domain record rather than a corrupt partial one —
// the same accepted tradeoff already documented for the recruitment→
// onboarding conversion in lib/server/hr/recruitment.ts.
//
// Authorization for inline creation is INTENTIONALLY narrow: it is gated
// ONLY by users.manage + canProvisionRole (the account-provisioning
// boundary), never by hr.manage/students.create/guardians.update (the
// HR-module/admissions-module management boundaries) — granting a role
// account-provisioning rights here must never silently also grant it
// Department/Payroll/Recruitment/admissions-pipeline management powers.
import { z } from "zod";
import type { Prisma, UserStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { parseInput } from "@/lib/server/validation";
import type { OrgScope } from "@/lib/server/api/scope";
import type { AuthzContext } from "@/lib/server/authz/permissions";
import { recordAudit } from "@/lib/server/api/audit";
import { createPasswordSetupToken, passwordStrengthSchema } from "@/lib/server/auth/password-setup";
import { hashPassword } from "@/lib/server/password";
import { createStaffSchema, createStaff } from "@/lib/server/staff/service";
import { studentCreateSchema, createStudent } from "@/lib/server/students/service";
import { guardianCreateSchema, linkGuardianToStudent } from "@/lib/server/guardians/service";
import { getTeacherOwnedStudentIds } from "@/lib/server/users/teacher-scope";
import {
  canProvisionRole,
  provisionableRoleKeysFor,
  ROLE_CREATION_POLICY,
  STAFF_LINKED_ROLE_KEYS,
  STUDENT_ROLE_KEY,
  GUARDIAN_ROLE_KEY,
} from "@/lib/server/authz/role-creation-policy";

type Tx = Prisma.TransactionClient;

const BROADER_THAN_TEACHER_ROLE_KEYS = new Set(Object.keys(ROLE_CREATION_POLICY).filter((k) => k !== "TEACHER"));

/**
 * Whether this actor's account-management authority must be narrowed to
 * their own teaching scope. Deliberately NOT `ctx.activeRoleKey === "TEACHER"`
 * — activeRoleKey is only the UI's current "which hat am I wearing" selection
 * and can be null (e.g. a dual-role account that has not yet picked a role
 * after login — resolvePostLogin routes it to /select-role but its session
 * cookie is already valid for direct API calls) while
 * requirePermission("users.manage") still passes via resolveUserAuthz's
 * documented "union of all assigned roles when none selected" fallback.
 * Relying on activeRoleKey alone would then silently SKIP teacher-scoping for
 * someone whose users.manage grant comes from TEACHER, handing them the full
 * unscoped view — a real gap, found via live testing, not hypothetical.
 * Instead this looks at the caller's REAL assigned role keys in this tenant:
 * narrow whenever TEACHER is among them and no broader provisioning role (any
 * other ROLE_CREATION_POLICY key) is also assigned — a dual-role account that
 * also holds e.g. SCHOOL_ADMIN gets that broader, unscoped authority instead,
 * regardless of which role happens to be "active".
 */
export async function isTeacherScopedActor(ctx: AuthzContext, scope: OrgScope): Promise<boolean> {
  const assignments = await prisma.roleAssignment.findMany({
    where: { membership: { userId: ctx.user.id, tenantId: scope.tenantId, status: "ACTIVE" } },
    select: { role: { select: { key: true } } },
  });
  const keys = new Set(assignments.map((a) => a.role.key));
  if (!keys.has("TEACHER")) return false;
  for (const k of keys) {
    if (BROADER_THAN_TEACHER_ROLE_KEYS.has(k)) return false;
  }
  return true;
}

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

/** Every real system role — for the User List's "Role" filter dropdown. Not
 * policy-gated (unlike getProvisionableRoles): knowing role NAMES is not a
 * sensitive capability — listAccounts already returns each visible user's
 * role names — this just lets the filter offer the full real set rather than
 * only the actor's own provisionable subset. */
export async function listAllRoleOptions(): Promise<{ key: string; name: string }[]> {
  return prisma.role.findMany({ where: { isSystem: true }, select: { key: true, name: true }, orderBy: { name: "asc" } });
}

// --- Provision / link ---------------------------------------------------------

const newGuardianSchema = guardianCreateSchema.extend({
  linkToStudentId: z.string().trim().min(1),
  relation: z.enum(["father", "mother", "guardian"]).default("guardian"),
});

const provisionSchema = z
  .object({
    targetRoleKey: z.string().min(1),
    email: z.string().email().transform((s) => s.toLowerCase()),
    name: z.string().trim().min(1).max(200).optional(),
    // Link an existing, unlinked domain record…
    staffId: z.string().min(1).optional(),
    studentId: z.string().min(1).optional(),
    guardianId: z.string().min(1).optional(),
    // …OR create one inline, reusing the real domain services.
    newStaff: createStaffSchema.optional(),
    newStudent: studentCreateSchema.optional(),
    newGuardian: newGuardianSchema.optional(),
    // Optional direct credentials — set a real password immediately instead
    // of the invite-link flow (see `DirectCredentials` below). Omitted
    // entirely, existing callers (e.g. the Student self-service "Add/Invite
    // My Guardian" flow) are completely unaffected — invite-link behavior is
    // unchanged unless password is explicitly provided.
    password: passwordStrengthSchema.optional(),
    confirmPassword: z.string().optional(),
    forcePasswordChange: z.boolean().optional(),
    status: z.enum(["active", "inactive"]).optional(),
  })
  .refine((v) => !v.password || v.password === v.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });

export type ProvisionAccountResult = {
  userId: string;
  targetRoleKey: string;
  accountCreated: boolean; // a brand-new User row was created
  accountLinked: boolean; // Staff/Student/Guardian.userId was (re)linked
  domainRecordCreated: boolean; // a brand-new Staff/Student/Guardian row was created inline
  passwordSetDirectly: boolean; // true when a real password was set now (no setup link ever issued)
  passwordSetupPending: boolean; // true unless reusing an already-ACTIVE user or setting a password directly
  passwordSetupUrl: string | null; // relative path; null when nothing to set up
};

/** Precomputed direct-password credentials for a brand-new User row. Never
 * applied to an EXISTING (reused-by-email) account — see findOrCreateUser. */
type DirectCredentials = { passwordHash: string; status: "ACTIVE" | "INACTIVE"; passwordSetupRequired: boolean };

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

  const credentials: DirectCredentials | null = input.password
    ? { passwordHash: await hashPassword(input.password), status: input.status === "inactive" ? "INACTIVE" : "ACTIVE", passwordSetupRequired: input.forcePasswordChange ?? false }
    : null;

  if ((STAFF_LINKED_ROLE_KEYS as readonly string[]).includes(input.targetRoleKey)) {
    // No real system role currently grants a TEACHER the right to provision a
    // Staff-linked target (canProvisionRole already rejected it above), so
    // this branch is only ever reached for a non-Teacher actor.
    let staffId = input.staffId ?? null;
    let domainRecordCreated = false;
    if (!staffId) {
      if (!input.newStaff) throw new HttpError("VALIDATION_ERROR", "Provide staffId or newStaff details");
      const created = await createStaff(scope, { ...input.newStaff, isTeaching: input.targetRoleKey === "TEACHER" ? true : input.newStaff.isTeaching });
      staffId = created.id;
      domainRecordCreated = true;
    }
    const result = await provisionStaffLinked(ctx, scope, input.targetRoleKey, targetRole.id, staffId, input.email, input.name, credentials);
    return { ...result, domainRecordCreated };
  }
  if (input.targetRoleKey === STUDENT_ROLE_KEY) {
    let studentId = input.studentId ?? null;
    let domainRecordCreated = false;
    if (!studentId) {
      if (!input.newStudent) throw new HttpError("VALIDATION_ERROR", "Provide studentId or newStudent details");
      const created = await createStudent(scope, input.newStudent);
      studentId = created.id;
      domainRecordCreated = true;
    } else if (await isTeacherScopedActor(ctx, scope)) {
      const owned = await getTeacherOwnedStudentIds(scope, ctx.user.id);
      if (!owned.has(studentId)) throw new HttpError("ROLE_NOT_ALLOWED", "You may only provision accounts for students you teach");
    }
    const result = await provisionStudent(scope, targetRole.id, studentId, input.email, input.name, credentials);
    return { ...result, domainRecordCreated };
  }
  if (input.targetRoleKey === GUARDIAN_ROLE_KEY) {
    let guardianId = input.guardianId ?? null;
    let domainRecordCreated = false;
    if (!guardianId) {
      if (!input.newGuardian) throw new HttpError("VALIDATION_ERROR", "Provide guardianId or newGuardian details");
      if (await isTeacherScopedActor(ctx, scope)) {
        const owned = await getTeacherOwnedStudentIds(scope, ctx.user.id);
        if (!owned.has(input.newGuardian.linkToStudentId)) throw new HttpError("ROLE_NOT_ALLOWED", "You may only add a guardian for a student you teach");
      }
      const { linkToStudentId, relation, ...guardianFields } = input.newGuardian;
      const linkResult = await linkGuardianToStudent(scope, linkToStudentId, { guardian: guardianFields, relation });
      guardianId = linkResult.guardianId;
      domainRecordCreated = true;
    } else if (await isTeacherScopedActor(ctx, scope)) {
      const owned = await getTeacherOwnedStudentIds(scope, ctx.user.id);
      const links = await prisma.studentGuardian.findMany({ where: { guardianId }, select: { studentId: true } });
      if (!links.some((l) => owned.has(l.studentId))) {
        throw new HttpError("ROLE_NOT_ALLOWED", "You may only provision a guardian login connected to a student you teach");
      }
    }
    const result = await provisionGuardian(scope, targetRole.id, guardianId, input.email, input.name, credentials);
    return { ...result, domainRecordCreated };
  }
  // Unreachable: every key in ROLE_CREATION_POLICY is one of the three shapes above.
  throw new HttpError("TARGET_ROLE_NOT_FOUND", "Unsupported target role shape");
}

/** Find-or-create the User for `email` inside `tx`, matching the existing
 * school-provisioning pattern: reuse silently, never touch an existing
 * password. `credentials`, when given, apply ONLY to a brand-new User row —
 * reusing an existing account by email NEVER changes its password or status,
 * regardless of what this request asked for. */
async function findOrCreateUser(tx: Tx, email: string, name: string | undefined, credentials: DirectCredentials | null): Promise<{ id: string; isNew: boolean; status: string }> {
  const existing = await tx.user.findUnique({ where: { email }, select: { id: true, status: true } });
  if (existing) return { id: existing.id, isNew: false, status: existing.status };
  const created = await tx.user.create({
    // emailVerifiedAt is deliberately left unset here — a direct admin-set
    // password proves nothing about control of the email address (unlike
    // completing the invite-link flow, which does: the link only reaches
    // someone via that inbox).
    data: credentials
      ? { email, name: name ?? null, passwordHash: credentials.passwordHash, status: credentials.status, passwordSetupRequired: credentials.passwordSetupRequired }
      : { email, name: name ?? null, passwordHash: null, status: "INVITED", passwordSetupRequired: true },
    select: { id: true, status: true },
  });
  return { id: created.id, isNew: true, status: created.status };
}

/**
 * When reusing an existing User (found by email), a Staff/Student/Guardian
 * link is a global 1:1 (each column is `userId @unique`) AND mutually
 * exclusive ACROSS kinds — one User can never be linked to a Staff row and
 * also a Student row (or a Guardian row, etc). This must check all three
 * domain tables, not just the one matching `kind`: a User already linked as
 * Staff must be rejected here even when the caller is now trying to link it
 * as a Student, otherwise a same-kind-only check silently lets one login
 * front two unrelated identities. Without this check some cross-kind
 * attempts still fail via the DB's own unique constraint, but as a raw,
 * unhandled Prisma error; this turns every case into the same typed CONFLICT
 * the rest of the API surface uses.
 */
async function assertNotLinkedToADifferentRecord(tx: Tx, kind: "staff" | "student" | "guardian", userId: string, targetId: string): Promise<void> {
  const [staff, student, guardian] = await Promise.all([
    tx.staff.findUnique({ where: { userId }, select: { id: true } }),
    tx.student.findUnique({ where: { userId }, select: { id: true } }),
    tx.guardian.findUnique({ where: { userId }, select: { id: true } }),
  ]);
  const isSameTarget =
    (kind === "staff" && staff?.id === targetId) ||
    (kind === "student" && student?.id === targetId) ||
    (kind === "guardian" && guardian?.id === targetId);
  if ((staff || student || guardian) && !isSameTarget) {
    throw new HttpError("ACCOUNT_ALREADY_LINKED_ELSEWHERE", "This email's account is already linked to a different record");
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

/** Issue a setup token for a newly-created or still-INVITED user; null for an
 * already-ACTIVE user, or whenever a real password was just set directly
 * (`skip` — that account never needs an invite link, whatever its status). */
async function maybeIssueSetupToken(tx: Tx, userId: string, userStatus: string, skip: boolean): Promise<string | null> {
  if (skip || userStatus === "ACTIVE") return null;
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
  credentials: DirectCredentials | null,
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
    const user = await findOrCreateUser(tx, email, displayName || undefined, credentials);
    await assertNotLinkedToADifferentRecord(tx, "staff", user.id, staff.id);
    await ensureMembershipAndRole(tx, user.id, scope.tenantId, targetRoleId);
    // Atomic conditional update (compare-and-swap on userId IS NULL) — closes
    // the race where two concurrent requests both pass the `!staff.userId`
    // check above before either commits. Only one can win this WHERE clause.
    const linked = await tx.staff.updateMany({ where: { id: staff.id, userId: null }, data: { userId: user.id } });
    if (linked.count === 0) throw new HttpError("STAFF_ALREADY_LINKED", "This Staff record already has a login account");
    const passwordSetDirectly = user.isNew && credentials !== null;
    const passwordSetupUrl = await maybeIssueSetupToken(tx, user.id, user.status, passwordSetDirectly);

    await recordAudit(tx, scope, "USER_ACCOUNT_PROVISIONED", "User", user.id, { targetRoleKey, staffId, accountCreated: user.isNew, passwordSetDirectly });
    await recordAudit(tx, scope, "USER_ROLE_ASSIGNED", "User", user.id, { roleKey: targetRoleKey });
    await recordAudit(tx, scope, "USER_ACCOUNT_LINKED", "Staff", staff.id, { userId: user.id });

    return {
      userId: user.id,
      targetRoleKey,
      accountCreated: user.isNew,
      accountLinked: true,
      domainRecordCreated: false, // caller overwrites this — see provisionAccount
      passwordSetDirectly,
      passwordSetupPending: passwordSetupUrl !== null,
      passwordSetupUrl,
    };
  });
}

async function provisionStudent(
  scope: OrgScope,
  targetRoleId: string,
  studentId: string,
  email: string,
  name: string | undefined,
  credentials: DirectCredentials | null,
): Promise<ProvisionAccountResult> {
  return prisma.$transaction(async (tx) => {
    const student = await tx.student.findFirst({
      where: { id: studentId, tenantId: scope.tenantId, schoolId: scope.schoolId },
      select: { id: true, userId: true, firstName: true, lastName: true, status: true },
    });
    if (!student) throw new HttpError("NOT_FOUND", "Student not found");
    if (student.userId) throw new HttpError("STUDENT_ALREADY_LINKED", "This Student already has a login account");
    if (student.status !== "ACTIVE") throw new HttpError("VALIDATION_ERROR", "Only an ACTIVE student may be provisioned a login account");

    const displayName = name ?? [student.firstName, student.lastName].filter(Boolean).join(" ");
    const user = await findOrCreateUser(tx, email, displayName || undefined, credentials);
    await assertNotLinkedToADifferentRecord(tx, "student", user.id, student.id);
    await ensureMembershipAndRole(tx, user.id, scope.tenantId, targetRoleId);
    // Atomic conditional update — see the identical comment in provisionStaffLinked.
    const linked = await tx.student.updateMany({ where: { id: student.id, userId: null }, data: { userId: user.id } });
    if (linked.count === 0) throw new HttpError("STUDENT_ALREADY_LINKED", "This Student already has a login account");
    const passwordSetDirectly = user.isNew && credentials !== null;
    const passwordSetupUrl = await maybeIssueSetupToken(tx, user.id, user.status, passwordSetDirectly);

    await recordAudit(tx, scope, "USER_ACCOUNT_PROVISIONED", "User", user.id, { targetRoleKey: STUDENT_ROLE_KEY, studentId, accountCreated: user.isNew, passwordSetDirectly });
    await recordAudit(tx, scope, "USER_ROLE_ASSIGNED", "User", user.id, { roleKey: STUDENT_ROLE_KEY });
    await recordAudit(tx, scope, "USER_ACCOUNT_LINKED", "Student", student.id, { userId: user.id });

    return {
      userId: user.id,
      targetRoleKey: STUDENT_ROLE_KEY,
      accountCreated: user.isNew,
      accountLinked: true,
      domainRecordCreated: false,
      passwordSetDirectly,
      passwordSetupPending: passwordSetupUrl !== null,
      passwordSetupUrl,
    };
  });
}

/** Exported for reuse by the Student self-service "Add/Invite My Guardian"
 * flow (lib/server/students/self-guardian.ts) — that flow enforces its own
 * identity-scoped authorization before ever calling this. */
export async function provisionGuardian(
  scope: OrgScope,
  targetRoleId: string,
  guardianId: string,
  email: string,
  name: string | undefined,
  credentials: DirectCredentials | null = null,
): Promise<ProvisionAccountResult> {
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
    const user = await findOrCreateUser(tx, email, displayName || undefined, credentials);
    await assertNotLinkedToADifferentRecord(tx, "guardian", user.id, guardian.id);
    await ensureMembershipAndRole(tx, user.id, scope.tenantId, targetRoleId);
    // Atomic conditional update — see the identical comment in provisionStaffLinked.
    const linked = await tx.guardian.updateMany({ where: { id: guardian.id, userId: null }, data: { userId: user.id } });
    if (linked.count === 0) throw new HttpError("GUARDIAN_ALREADY_LINKED", "This Guardian already has a login account");
    const passwordSetDirectly = user.isNew && credentials !== null;
    const passwordSetupUrl = await maybeIssueSetupToken(tx, user.id, user.status, passwordSetDirectly);

    await recordAudit(tx, scope, "USER_ACCOUNT_PROVISIONED", "User", user.id, { targetRoleKey: GUARDIAN_ROLE_KEY, guardianId, accountCreated: user.isNew, passwordSetDirectly });
    await recordAudit(tx, scope, "USER_ROLE_ASSIGNED", "User", user.id, { roleKey: GUARDIAN_ROLE_KEY });
    await recordAudit(tx, scope, "USER_ACCOUNT_LINKED", "Guardian", guardian.id, { userId: user.id });

    return {
      userId: user.id,
      targetRoleKey: GUARDIAN_ROLE_KEY,
      accountCreated: user.isNew,
      accountLinked: true,
      domainRecordCreated: false,
      passwordSetDirectly,
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
  image: string | null;
  mobile: string | null;
  status: string;
  passwordSetupRequired: boolean;
  roles: { key: string; name: string }[];
  staffId: string | null;
  studentId: string | null;
  guardianId: string | null;
  branchId: string | null;
  branchName: string | null;
  designation: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * List every real User with a TenantMembership in the caller's tenant,
 * scoped to the caller's own SCHOOL — a Staff/Student record belongs to one
 * School; a Guardian (tenant-scoped only, no schoolId of its own) counts if
 * any of their real StudentGuardian links point to a Student in that School.
 * An account with no domain link at all (e.g. a bare platform-level invite)
 * is not attributable to any school and is never excluded on that basis.
 *
 * `users.manage` required (enforced by the route). A TEACHER caller — who
 * holds users.manage ONLY for provisioning within their own teaching scope —
 * is further restricted here to Student/Guardian accounts for students they
 * actually teach; a Teacher never sees the school's Staff directory through
 * this endpoint, matching the "no unrestricted sensitive staff-management
 * list" rule.
 *
 * Filters: role/status are real column/relation filters; branchId filters by
 * the linked Staff/Student's real branchId (Guardian has no single branch of
 * its own — a branch filter simply excludes Guardian-only rows rather than
 * guessing one from their linked students). "School" is deliberately not a
 * filter: OrgScope is single-school per session (see requireOrgScope) — there
 * is never more than one school to choose from within one page load.
 */
const listAccountsFilterSchema = z.object({
  role: z.string().trim().min(1).optional(),
  status: z.enum(["INVITED", "ACTIVE", "LOCKED", "SUSPENDED", "INACTIVE"]).optional(),
  branchId: z.string().trim().min(1).optional(),
});

export async function listAccounts(
  ctx: AuthzContext,
  scope: OrgScope,
  raw: { page?: number; pageSize?: number; search?: string | null; role?: string | null; status?: string | null; branchId?: string | null },
): Promise<{ data: AccountListItem[]; meta: { page: number; pageSize: number; total: number; totalPages: number; schoolName: string | null } }> {
  const page = Math.max(1, raw.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, raw.pageSize ?? 25));
  const search = raw.search?.trim();
  const filters = parseInput(listAccountsFilterSchema, {
    role: raw.role || undefined,
    status: raw.status || undefined,
    branchId: raw.branchId || undefined,
  });

  const userConditions: Prisma.UserWhereInput[] = [
    {
      OR: [
        { staffProfile: { schoolId: scope.schoolId } },
        { studentProfile: { schoolId: scope.schoolId } },
        { guardianProfile: { students: { some: { student: { schoolId: scope.schoolId } } } } },
        { staffProfile: null, studentProfile: null, guardianProfile: null },
      ],
    },
  ];
  if (search) {
    userConditions.push({ OR: [{ email: { contains: search, mode: "insensitive" } }, { name: { contains: search, mode: "insensitive" } }] });
  }
  if (filters.status) {
    userConditions.push({ status: filters.status as UserStatus });
  }
  if (filters.branchId) {
    userConditions.push({ OR: [{ staffProfile: { branchId: filters.branchId } }, { studentProfile: { branchId: filters.branchId } }] });
  }
  if (await isTeacherScopedActor(ctx, scope)) {
    const ownedStudentIds = [...(await getTeacherOwnedStudentIds(scope, ctx.user.id))];
    userConditions.push({
      OR: [
        { studentProfile: { id: { in: ownedStudentIds } } },
        { guardianProfile: { students: { some: { studentId: { in: ownedStudentIds } } } } },
      ],
    });
  }

  const where: Prisma.TenantMembershipWhereInput = {
    tenantId: scope.tenantId,
    user: { AND: userConditions },
    ...(filters.role ? { roleAssignments: { some: { role: { key: filters.role } } } } : {}),
  };

  const [total, rows, school] = await Promise.all([
    prisma.tenantMembership.count({ where }),
    prisma.tenantMembership.findMany({
      where,
      select: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            status: true,
            passwordSetupRequired: true,
            createdAt: true,
            updatedAt: true,
            staffProfile: { select: { id: true, branchId: true, designation: true, phone: true } },
            studentProfile: { select: { id: true, branchId: true, phone: true } },
            guardianProfile: { select: { id: true, phone: true } },
          },
        },
        roleAssignments: { select: { role: { select: { key: true, name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.school.findUnique({ where: { id: scope.schoolId }, select: { name: true } }),
  ]);

  const branchIds = [...new Set(rows.map((r) => r.user.staffProfile?.branchId ?? r.user.studentProfile?.branchId).filter((v): v is string => Boolean(v)))];
  const branches = branchIds.length ? await prisma.branch.findMany({ where: { id: { in: branchIds } }, select: { id: true, name: true } }) : [];
  const branchNameById = new Map(branches.map((b) => [b.id, b.name]));

  return {
    data: rows.map((r) => {
      const branchId = r.user.staffProfile?.branchId ?? r.user.studentProfile?.branchId ?? null;
      return {
        id: r.user.id,
        name: r.user.name,
        email: r.user.email,
        image: r.user.image,
        mobile: r.user.staffProfile?.phone ?? r.user.studentProfile?.phone ?? r.user.guardianProfile?.phone ?? null,
        status: r.user.status,
        passwordSetupRequired: r.user.passwordSetupRequired,
        roles: r.roleAssignments.map((ra) => ra.role),
        staffId: r.user.staffProfile?.id ?? null,
        studentId: r.user.studentProfile?.id ?? null,
        guardianId: r.user.guardianProfile?.id ?? null,
        branchId,
        branchName: branchId ? (branchNameById.get(branchId) ?? null) : null,
        designation: r.user.staffProfile?.designation ?? null,
        createdAt: r.user.createdAt.toISOString(),
        updatedAt: r.user.updatedAt.toISOString(),
      };
    }),
    meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)), schoolName: school?.name ?? null },
  };
}

async function requireUserInTenant(userId: string, tenantId: string): Promise<void> {
  const membership = await prisma.tenantMembership.findUnique({ where: { userId_tenantId: { userId, tenantId } }, select: { id: true } });
  if (!membership) throw new HttpError("USER_NOT_FOUND", "User not found in your school");
}

/** A TEACHER may only act on a Student/Guardian account within their own
 * teaching scope — never a Staff account, never an out-of-scope student.
 * Exported for reuse by lib/server/users/account-detail.ts (View Profile /
 * Edit Account / View Activity carry the identical scoping rule). */
export async function requireTeacherScopedTarget(scope: OrgScope, teacherUserId: string, targetUserId: string): Promise<void> {
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { staffProfile: { select: { id: true } }, studentProfile: { select: { id: true } }, guardianProfile: { select: { students: { select: { studentId: true } } } } },
  });
  if (!target) throw new HttpError("USER_NOT_FOUND", "User not found");
  if (target.staffProfile) throw new HttpError("ROLE_NOT_ALLOWED", "Your role may not manage a Staff account");
  const owned = await getTeacherOwnedStudentIds(scope, teacherUserId);
  const inScope = (target.studentProfile && owned.has(target.studentProfile.id)) || (target.guardianProfile && target.guardianProfile.students.some((s) => owned.has(s.studentId)));
  if (!inScope) throw new HttpError("ROLE_NOT_ALLOWED", "You may only manage accounts for students you teach");
}

// --- Status -------------------------------------------------------------------

const statusSchema = z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]) });

/** Suspend or reactivate a user's account. Never a hard delete — see spec §32. */
export async function setAccountStatus(ctx: AuthzContext, scope: OrgScope, userId: string, raw: unknown): Promise<void> {
  const input = parseInput(statusSchema, raw);
  if (userId === ctx.user.id && input.status === "SUSPENDED") {
    throw new HttpError("VALIDATION_ERROR", "You cannot suspend your own account");
  }
  await requireUserInTenant(userId, scope.tenantId);
  if (await isTeacherScopedActor(ctx, scope)) await requireTeacherScopedTarget(scope, ctx.user.id, userId);

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

// --- Reset password / reissue setup link ---------------------------------------

/**
 * Admin-triggered password reset: clears the existing password (if any),
 * puts the account back into INVITED/setup-required state, and issues a
 * fresh one-time setup link — reusing the EXACT SAME real primitive
 * (createPasswordSetupToken) the original provisioning flow uses. There is
 * still no email provider: the raw link is returned once, for the caller to
 * share manually, exactly like account creation already does.
 */
export async function reissuePasswordSetup(ctx: AuthzContext, scope: OrgScope, userId: string): Promise<{ passwordSetupUrl: string }> {
  await requireUserInTenant(userId, scope.tenantId);
  if (await isTeacherScopedActor(ctx, scope)) await requireTeacherScopedTarget(scope, ctx.user.id, userId);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { status: true } });
    if (!user) throw new HttpError("USER_NOT_FOUND", "User not found");
    if (user.status === "SUSPENDED") throw new HttpError("ACCOUNT_INACTIVE", "Reactivate this account before resetting its password");
    await tx.user.update({ where: { id: userId }, data: { passwordHash: null, status: "INVITED", passwordSetupRequired: true } });
    const { token } = await createPasswordSetupToken(tx, userId);
    await recordAudit(tx, scope, "PASSWORD_RESET", "User", userId, {});
    return { passwordSetupUrl: `/setup-password?token=${token}` };
  });
}

// --- Assign an additional role to an existing account --------------------------

const assignRoleSchema = z.object({ targetRoleKey: z.string().min(1) });

/** Grant an existing user an additional role, subject to the SAME ROLE_CREATION_POLICY as fresh provisioning. */
export async function assignRoleToAccount(ctx: AuthzContext, scope: OrgScope, userId: string, raw: unknown): Promise<void> {
  const input = parseInput(assignRoleSchema, raw);
  // Self-safety: never let an actor change their own role through this admin
  // surface — this is the single check that covers both "no privilege
  // escalation" and "never remove your own required administrative access"
  // (canProvisionRole already forbids granting a role the actor could use to
  // escalate; blocking self entirely removes any need to separately detect
  // "is this my own only admin role").
  if (userId === ctx.user.id) {
    throw new HttpError("ROLE_NOT_ALLOWED", "You cannot change your own role");
  }
  if (!canProvisionRole(ctx.activeRoleKey, input.targetRoleKey)) {
    throw new HttpError("ROLE_NOT_ALLOWED", `Your role may not assign a ${input.targetRoleKey} role`);
  }
  await requireUserInTenant(userId, scope.tenantId);
  if (await isTeacherScopedActor(ctx, scope)) await requireTeacherScopedTarget(scope, ctx.user.id, userId);

  const role = await prisma.role.findFirst({ where: { key: input.targetRoleKey, isSystem: true }, select: { id: true } });
  if (!role) throw new HttpError("TARGET_ROLE_NOT_FOUND", "That role is not configured");

  await prisma.$transaction(async (tx) => {
    await ensureMembershipAndRole(tx, userId, scope.tenantId, role.id);
    await recordAudit(tx, scope, "USER_ROLE_ASSIGNED", "User", userId, { roleKey: input.targetRoleKey });
  });
}
